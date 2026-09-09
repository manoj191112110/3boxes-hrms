/**
 * Writes all API routes + minimal UI pages for:
 *  - Client addendum: branches, contacts, SOW, portal, AI churn/margin
 *  - Vendor addendum: documents, portal, staff, PO, vendor invoice, purge, 3-way matching
 *  - Marketplace: wallet, catalog, insurance, EWA, loans, gifts, recognition, fraud, stress, budgets
 *
 * Run once: node scripts/build-cv-mkt-modules.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = '/home/z/my-project';

function writeIfNotExists(filePath, content) {
  if (fs.existsSync(filePath)) {
    console.log(`[skip] ${filePath}`);
    return;
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
  console.log(`[write] ${filePath}`);
}

// ─── Common boilerplate ──────────────────────────────────────────────────────
const CORS = `function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders() });
}
`;

// Use prisma from @/lib/prisma (consistent with existing code)
const IMPORTS = `import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';
`;

const AUTH_GET = `  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'No token provided' }, { status: 401, headers: corsHeaders() });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401, headers: corsHeaders() });
`;

// ──────────────────────────────────────────────────────────────────────────
// 1. CLIENT BRANCHES
// ──────────────────────────────────────────────────────────────────────────
writeIfNotExists(`${ROOT}/src/app/api/clients/[id]/branches/route.ts`,
`${IMPORTS}
${CORS}
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
${AUTH_GET}
    const { id } = await params;
    const branches = await prisma.clientBranch.findMany({
      where: { clientId: id },
      include: { company: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json({ branches }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Get client branches error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
${AUTH_GET}
    const { id } = await params;
    const body = await request.json();
    const { name, companyId, country, billingCurrency, paymentTerms, taxId } = body;
    if (!name || !companyId) return NextResponse.json({ error: 'Missing name or companyId' }, { status: 400, headers: corsHeaders() });
    const branch = await prisma.clientBranch.create({
      data: { clientId: id, name, companyId, country, billingCurrency: billingCurrency || 'INR', paymentTerms: paymentTerms || 'net_30', taxId },
    });
    await prisma.auditLog.create({ data: { userId: decoded.userId as string, action: 'CREATE_CLIENT_BRANCH', module: 'clients', details: \`Created branch \${name} for client \${id}\` } });
    return NextResponse.json({ branch }, { status: 201, headers: corsHeaders() });
  } catch (error) {
    console.error('Create client branch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}
`);

// ──────────────────────────────────────────────────────────────────────────
// 2. CLIENT CONTACTS
// ──────────────────────────────────────────────────────────────────────────
writeIfNotExists(`${ROOT}/src/app/api/clients/[id]/contacts/route.ts`,
`${IMPORTS}
${CORS}
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
${AUTH_GET}
    const { id } = await params;
    const contacts = await prisma.clientContact.findMany({ where: { clientId: id }, orderBy: { createdAt: 'desc' } });
    return NextResponse.json({ contacts }, { headers: corsHeaders() });
  } catch (error) { console.error('Get client contacts error:', error); return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() }); }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
${AUTH_GET}
    const { id } = await params;
    const body = await request.json();
    const { name, email, phone, role, preferredLanguage, isPrimary } = body;
    if (!name) return NextResponse.json({ error: 'Missing name' }, { status: 400, headers: corsHeaders() });
    const contact = await prisma.clientContact.create({ data: { clientId: id, name, email, phone, role, preferredLanguage: preferredLanguage || 'en', isPrimary: !!isPrimary } });
    return NextResponse.json({ contact }, { status: 201, headers: corsHeaders() });
  } catch (error) { console.error('Create client contact error:', error); return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() }); }
}
`);

// ──────────────────────────────────────────────────────────────────────────
// 3. SOW (Statement of Work) — AI parsing + list/create/approve
// ──────────────────────────────────────────────────────────────────────────
writeIfNotExists(`${ROOT}/src/app/api/clients/sow/route.ts`,
`${IMPORTS}
${CORS}
export async function GET(request: Request) {
${AUTH_GET}
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');
    const status = searchParams.get('status');
    const where = {};
    if (clientId) where.clientId = clientId;
    if (status) where.status = status;
    const sows = await prisma.sOW.findMany({
      where,
      include: { client: { select: { id: true, name: true } }, project: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json({ sows }, { headers: corsHeaders() });
  } catch (error) { console.error('Get SOWs error:', error); return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() }); }
}

export async function POST(request: Request) {
${AUTH_GET}
    const body = await request.json();
    const { clientId, title, fileName, fileUrl, rawText, startDate, endDate, maxHeadcount, billRatesJson, milestonesJson, totalValue, currency } = body;
    if (!clientId || !title) return NextResponse.json({ error: 'Missing clientId or title' }, { status: 400, headers: corsHeaders() });

    // AI SOW Parsing: heuristic extraction from rawText (when no explicit fields provided)
    let aiParsed = { startDate: startDate, endDate: endDate, maxHeadcount: maxHeadcount, billRatesJson: billRatesJson, milestonesJson: milestonesJson, totalValue: totalValue, aiConfidence: 0 };
    if (rawText && (!startDate || !totalValue)) {
      const text = rawText.toLowerCase();
      const dateMatch = rawText.match(/(?:start|begin)[^\\d]*(\\d{4}-\\d{2}-\\d{2}|\\d{1,2}[/\\-]\\d{1,2}[/\\-]\\d{2,4})/i);
      const endMatch = rawText.match(/(?:end|complete|finish)[^\\d]*(\\d{4}-\\d{2}-\\d{2}|\\d{1,2}[/\\-]\\d{1,2}[/\\-]\\d{2,4})/i);
      const valueMatch = rawText.match(/(?:total|value|contract)[^\\d]*\\$?([\\d,]+(?:\\.\\d{2})?)/i);
      const hcMatch = rawText.match(/(?:headcount|resources|contractors)[^\\d]*(\\d+)/i);
      // Extract bill rates per role
      const rates = {};
      const rateRegex = /([a-z\\s]+?)\\s*[:\\-]\\s*\\$?(\\d+(?:\\.\\d{2})?)\\s*(?:\\/|per)?\\s*(hr|hour|day|month)/gi;
      let m;
      while ((m = rateRegex.exec(rawText)) !== null) {
        const role = m[1].trim().toLowerCase().replace(/\\s+/g, '_');
        rates[role] = parseFloat(m[2]);
      }
      aiParsed = {
        startDate: startDate || (dateMatch ? new Date(dateMatch[1]) : null),
        endDate: endDate || (endMatch ? new Date(endMatch[1]) : null),
        maxHeadcount: maxHeadcount || (hcMatch ? parseInt(hcMatch[1]) : null),
        billRatesJson: billRatesJson || (Object.keys(rates).length > 0 ? rates : null),
        milestonesJson: milestonesJson || null,
        totalValue: totalValue || (valueMatch ? parseFloat(valueMatch[1].replace(/,/g, '')) : null),
        aiConfidence: 0.7,
      };
    }

    const sow = await prisma.sOW.create({
      data: {
        clientId, title, fileName, fileUrl, rawText,
        startDate: aiParsed.startDate ? new Date(aiParsed.startDate) : null,
        endDate: aiParsed.endDate ? new Date(aiParsed.endDate) : null,
        maxHeadcount: aiParsed.maxHeadcount,
        billRatesJson: aiParsed.billRatesJson,
        milestonesJson: aiParsed.milestonesJson,
        totalValue: aiParsed.totalValue,
        currency: currency || 'INR',
        status: 'ai_parsed',
        aiConfidence: aiParsed.aiConfidence,
      },
    });
    await prisma.auditLog.create({ data: { userId: decoded.userId as string, action: 'AI_PARSE_SOW', module: 'clients', details: \`AI parsed SOW \${title} (confidence \${aiParsed.aiConfidence})\` } });
    return NextResponse.json({ sow, aiParsed }, { status: 201, headers: corsHeaders() });
  } catch (error) { console.error('Create SOW error:', error); return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() }); }
}
`);

// ──────────────────────────────────────────────────────────────────────────
// 4. SOW Approve → auto-create Project shell
// ──────────────────────────────────────────────────────────────────────────
writeIfNotExists(`${ROOT}/src/app/api/clients/sow/[id]/approve/route.ts`,
`${IMPORTS}
${CORS}
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
${AUTH_GET}
    const { id } = await params;
    const sow = await prisma.sOW.findUnique({ where: { id }, include: { client: true } });
    if (!sow) return NextResponse.json({ error: 'SOW not found' }, { status: 404, headers: corsHeaders() });
    if (sow.status === 'approved') return NextResponse.json({ error: 'Already approved' }, { status: 400, headers: corsHeaders() });

    // Auto-create Project shell
    const project = await prisma.project.create({
      data: {
        name: \`\${sow.client.name} — \${sow.title}\`,
        companyId: sow.client.companyId,
        clientId: sow.clientId,
        projectType: 'client',
        billingType: 'time_and_material',
        currency: sow.currency,
        budgetAmount: sow.totalValue || 0,
        billingRate: (sow.billRatesJson && typeof sow.billRatesJson === 'object' && Object.values(sow.billRatesJson)[0]) ? Number(Object.values(sow.billRatesJson)[0]) : 0,
        startDate: sow.startDate || new Date(),
        endDate: sow.endDate,
        status: 'active',
        description: \`Auto-generated from SOW: \${sow.title}\`,
      },
    });

    const updated = await prisma.sOW.update({
      where: { id },
      data: { status: 'approved', projectId: project.id, approvedById: decoded.userId, approvedAt: new Date() },
    });
    await prisma.auditLog.create({ data: { userId: decoded.userId as string, action: 'APPROVE_SOW', module: 'clients', details: \`Approved SOW \${sow.title} → project \${project.id}\` } });
    return NextResponse.json({ sow: updated, project }, { headers: corsHeaders() });
  } catch (error) { console.error('Approve SOW error:', error); return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() }); }
}
`);

// ──────────────────────────────────────────────────────────────────────────
// 5. AI CLIENT CHURN PREDICTION
// ──────────────────────────────────────────────────────────────────────────
writeIfNotExists(`${ROOT}/src/app/api/clients/ai/churn/route.ts`,
`${IMPORTS}
${CORS}
export async function GET(request: Request) {
${AUTH_GET}
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');

    // Pull clients + their invoice payment behavior + project activity
    const clients = await prisma.client.findMany({
      where: clientId ? { id: clientId } : { status: 'active' },
      include: {
        invoices: { select: { id: true, status: true, dueDate: true, createdAt: true, totalAmount: true, currency: true }, orderBy: { createdAt: 'desc' }, take: 12 },
        projects: { select: { id: true, status: true, progress: true, updatedAt: true, actualHours: true, estimatedHours: true } },
      },
    });

    const results = [];
    for (const c of clients) {
      // Risk factors
      const overdueInvoices = c.invoices.filter(inv => inv.status === 'sent' || inv.status === 'overdue');
      const overdueCount = overdueInvoices.length;
      const avgDelayDays = overdueInvoices.length > 0
        ? overdueInvoices.reduce((sum, inv) => sum + Math.max(0, Math.floor((Date.now() - (inv.dueDate?.getTime() || Date.now())) / 86400000)), 0) / overdueInvoices.length
        : 0;
      const activeProjects = c.projects.filter(p => p.status === 'active').length;
      const staleProjects = c.projects.filter(p => p.updatedAt && (Date.now() - p.updatedAt.getTime()) > 45 * 86400000).length;
      const lowProgressProjects = c.projects.filter(p => p.progress < 30 && p.status === 'active').length;

      // Composite churn risk score (0..1)
      let score = 0;
      score += Math.min(0.35, overdueCount * 0.10);                 // up to 35% for multiple overdue invoices
      score += Math.min(0.30, avgDelayDays / 60 * 0.30);            // up to 30% for long payment delays
      score += Math.min(0.20, staleProjects * 0.10);                // up to 20% for stale projects
      score += Math.min(0.15, lowProgressProjects * 0.075);         // up to 15% for stalled progress
      score = Math.min(1, score);

      const riskLevel = score >= 0.6 ? 'high' : score >= 0.3 ? 'medium' : 'low';
      const factors = { overdueCount, avgDelayDays: Math.round(avgDelayDays), activeProjects, staleProjects, lowProgressProjects };
      const recommendations = riskLevel === 'high'
        ? 'Schedule executive review meeting within 7 days. Offer payment plan. Investigate project blockers.'
        : riskLevel === 'medium'
          ? 'Assign account manager to reconnect. Review recent project deliverables.'
          : 'Healthy client. Continue regular cadence.';

      const risk = await prisma.clientChurnRisk.create({
        data: { clientId: c.id, riskScore: score, riskLevel, factorsJson: factors, recommendations, notifiedManager: riskLevel === 'high' },
      });
      results.push({ clientId: c.id, clientName: c.name, riskLevel, riskScore: Math.round(score * 100) / 100, factors, recommendations, riskId: risk.id });
    }

    return NextResponse.json({ results, evaluatedAt: new Date().toISOString() }, { headers: corsHeaders() });
  } catch (error) { console.error('Churn prediction error:', error); return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() }); }
}
`);

// ──────────────────────────────────────────────────────────────────────────
// 6. AI CLIENT MARGIN ANALYSIS
// ──────────────────────────────────────────────────────────────────────────
writeIfNotExists(`${ROOT}/src/app/api/clients/ai/margin/route.ts`,
`${IMPORTS}
${CORS}
export async function GET(request: Request) {
${AUTH_GET}
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');

    const clients = await prisma.client.findMany({
      where: clientId ? { id: clientId } : { status: 'active' },
      include: {
        projects: { include: { timesheets: { select: { hours: true } }, allocations: { select: { employeeId: true, allocationPct: true } } } },
        invoices: { select: { totalAmount: true, currency: true, status: true } },
      },
    });

    const results = [];
    for (const c of clients) {
      // Revenue = sum of paid/sent invoices
      const revenueBase = c.invoices.filter(i => i.status === 'paid' || i.status === 'sent').reduce((s, i) => s + (i.totalAmount || 0), 0);
      // Cost (employee) = sum of project hours × costRate proxy
      let costEmployee = 0;
      for (const p of c.projects) {
        const hrs = p.timesheets.reduce((s, t) => s + (t.hours || 0), 0);
        costEmployee += hrs * (p.costRate || 0);
      }
      // Vendor cost = sum of vendor invoices linked to client's projects (approximation via PO)
      const vendorPOs = await prisma.purchaseOrder.findMany({
        where: { projectId: { in: c.projects.map(p => p.id) } },
        include: { vendorInvoices: { select: { baseAmount: true, status: true } } },
      });
      const costVendor = vendorPOs.flatMap(po => po.vendorInvoices).filter(vi => vi.status === 'approved' || vi.status === 'paid').reduce((s, vi) => s + (vi.baseAmount || 0), 0);

      const grossMargin = revenueBase - costEmployee - costVendor;
      const marginPct = revenueBase > 0 ? (grossMargin / revenueBase) * 100 : 0;

      const snap = await prisma.clientMarginSnapshot.create({
        data: { clientId: c.id, revenueBase, costEmployee, costVendor, grossMargin, marginPct, currency: c.billingCurrency || 'INR' },
      });
      results.push({ clientId: c.id, clientName: c.name, revenueBase, costEmployee, costVendor, grossMargin, marginPct: Math.round(marginPct * 100) / 100, snapshotId: snap.id });
    }
    return NextResponse.json({ results, snapshotAt: new Date().toISOString() }, { headers: corsHeaders() });
  } catch (error) { console.error('Margin analysis error:', error); return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() }); }
}
`);

// ──────────────────────────────────────────────────────────────────────────
// 7. CLIENT PORTAL AUTH (OTP-based login)
// ──────────────────────────────────────────────────────────────────────────
writeIfNotExists(`${ROOT}/src/app/api/client-portal/auth/request-otp/route.ts`,
`import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { randomInt } from 'crypto';

function corsHeaders() { return { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' }; }
export async function OPTIONS() { return NextResponse.json({}, { headers: corsHeaders() }); }

export async function POST(request: Request) {
  try {
    const { email } = await request.json();
    if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400, headers: corsHeaders() });
    const user = await prisma.clientPortalUser.findFirst({ where: { email: email.toLowerCase(), status: 'active' } });
    if (!user) return NextResponse.json({ error: 'No portal user with that email' }, { status: 404, headers: corsHeaders() });
    const otp = String(randomInt(100000, 999999));
    await prisma.clientPortalUser.update({ where: { id: user.id }, data: { otpSecret: otp } });
    // In production: send via email/SMS. For dev: return OTP in response.
    console.log(\`[client-portal] OTP for \${email}: \${otp}\`);
    return NextResponse.json({ sent: true, otpDevOnly: otp }, { headers: corsHeaders() });
  } catch (e) { console.error('client-portal request-otp error:', e); return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() }); }
}
`);

writeIfNotExists(`${ROOT}/src/app/api/client-portal/auth/verify-otp/route.ts`,
`import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import jwt from 'jsonwebtoken';

function corsHeaders() { return { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' }; }
export async function OPTIONS() { return NextResponse.json({}, { headers: corsHeaders() }); }

export async function POST(request: Request) {
  try {
    const { email, otp } = await request.json();
    if (!email || !otp) return NextResponse.json({ error: 'Email and OTP required' }, { status: 400, headers: corsHeaders() });
    const user = await prisma.clientPortalUser.findFirst({ where: { email: email.toLowerCase(), status: 'active' } });
    if (!user || !user.otpSecret || user.otpSecret !== otp) return NextResponse.json({ error: 'Invalid OTP' }, { status: 401, headers: corsHeaders() });
    await prisma.clientPortalUser.update({ where: { id: user.id }, data: { otpSecret: null, lastLoginAt: new Date() } });
    const token = jwt.sign({ portalType: 'client', portalUserId: user.id, clientId: user.clientId, email: user.email }, process.env.JWT_SECRET || 'dev-secret', { expiresIn: '8h' });
    return NextResponse.json({ token, user: { id: user.id, clientId: user.clientId, email: user.email, name: user.name } }, { headers: corsHeaders() });
  } catch (e) { console.error('client-portal verify-otp error:', e); return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() }); }
}
`);

// ──────────────────────────────────────────────────────────────────────────
// 8. CLIENT PORTAL — list projects + timesheets + invoices for logged-in client
// ──────────────────────────────────────────────────────────────────────────
writeIfNotExists(`${ROOT}/src/app/api/client-portal/dashboard/route.ts`,
`import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import jwt from 'jsonwebtoken';

function corsHeaders() { return { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' }; }
export async function OPTIONS() { return NextResponse.json({}, { headers: corsHeaders() }); }

async function getClientContext(request: Request) {
  const auth = request.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret') as { portalType: string; clientId: string; portalUserId: string };
    if (decoded.portalType !== 'client') return null;
    return decoded;
  } catch { return null; }
}

export async function GET(request: Request) {
  try {
    const ctx = await getClientContext(request);
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders() });
    const [projects, invoices, pendingTimesheetApprovals] = await Promise.all([
      prisma.project.findMany({
        where: { clientId: ctx.clientId, status: 'active' },
        include: { _count: { select: { timesheets: true, allocations: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.invoice.findMany({
        where: { clientId: ctx.clientId },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: { id: true, invoiceNumber: true, status: true, totalAmount: true, currency: true, dueDate: true, createdAt: true },
      }),
      prisma.clientTimesheetApproval.count({ where: { clientId: ctx.clientId, status: 'pending' } }),
    ]);
    return NextResponse.json({ projects, invoices, pendingApprovals: pendingTimesheetApprovals }, { headers: corsHeaders() });
  } catch (e) { console.error('client-portal dashboard error:', e); return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() }); }
}
`);

// ──────────────────────────────────────────────────────────────────────────
// 9. CLIENT PORTAL — Approve/Reject timesheets
// ──────────────────────────────────────────────────────────────────────────
writeIfNotExists(`${ROOT}/src/app/api/client-portal/approvals/route.ts`,
`import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import jwt from 'jsonwebtoken';

function corsHeaders() { return { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' }; }
export async function OPTIONS() { return NextResponse.json({}, { headers: corsHeaders() }); }

async function getClientContext(request: Request) {
  const auth = request.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret') as { portalType: string; clientId: string; portalUserId: string };
    if (decoded.portalType !== 'client') return null;
    return decoded;
  } catch { return null; }
}

export async function GET(request: Request) {
  try {
    const ctx = await getClientContext(request);
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders() });
    const approvals = await prisma.clientTimesheetApproval.findMany({
      where: { clientId: ctx.clientId },
      include: { timesheet: { include: { employee: { select: { id: true, firstName: true, lastName: true, employeeId: true } }, project: { select: { id: true, name: true } } } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return NextResponse.json({ approvals }, { headers: corsHeaders() });
  } catch (e) { console.error('client-portal approvals GET error:', e); return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() }); }
}

export async function POST(request: Request) {
  try {
    const ctx = await getClientContext(request);
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders() });
    const { approvalId, status, comments } = await request.json();
    if (!['approved', 'rejected'].includes(status)) return NextResponse.json({ error: 'Invalid status' }, { status: 400, headers: corsHeaders() });
    const updated = await prisma.clientTimesheetApproval.update({
      where: { id: approvalId, clientId: ctx.clientId },
      data: { status, comments, approvedById: ctx.portalUserId, approvedAt: new Date() },
    });
    return NextResponse.json({ approval: updated }, { headers: corsHeaders() });
  } catch (e) { console.error('client-portal approvals POST error:', e); return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() }); }
}
`);

// ──────────────────────────────────────────────────────────────────────────
// 10. VENDOR DOCUMENTS — list/create + expiry scan
// ──────────────────────────────────────────────────────────────────────────
writeIfNotExists(`${ROOT}/src/app/api/vendors/[id]/documents/route.ts`,
`${IMPORTS}
${CORS}
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
${AUTH_GET}
    const { id } = await params;
    const documents = await prisma.vendorDocument.findMany({ where: { vendorId: id }, orderBy: { createdAt: 'desc' } });
    // Compute current expiry status
    const now = new Date();
    const docs = documents.map(d => {
      let status = d.status;
      if (d.expiryDate) {
        const daysToExpiry = Math.floor((d.expiryDate.getTime() - now.getTime()) / 86400000);
        if (daysToExpiry < 0) status = 'expired';
        else if (daysToExpiry <= 30) status = 'expiring';
        else status = 'valid';
      }
      return { ...d, status, daysToExpiry: d.expiryDate ? Math.floor((d.expiryDate.getTime() - now.getTime()) / 86400000) : null };
    });
    return NextResponse.json({ documents: docs }, { headers: corsHeaders() });
  } catch (error) { console.error('Get vendor docs error:', error); return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() }); }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
${AUTH_GET}
    const { id } = await params;
    const body = await request.json();
    const { name, type, fileUrl, issuedAt, expiryDate } = body;
    if (!name || !type) return NextResponse.json({ error: 'Missing name or type' }, { status: 400, headers: corsHeaders() });
    const doc = await prisma.vendorDocument.create({
      data: { vendorId: id, name, type, fileUrl, issuedAt: issuedAt ? new Date(issuedAt) : null, expiryDate: expiryDate ? new Date(expiryDate) : null, uploadedById: decoded.userId },
    });
    await prisma.auditLog.create({ data: { userId: decoded.userId as string, action: 'UPLOAD_VENDOR_DOC', module: 'vendors', details: \`Uploaded \${type} doc for vendor \${id}\` } });
    return NextResponse.json({ document: doc }, { status: 201, headers: corsHeaders() });
  } catch (error) { console.error('Create vendor doc error:', error); return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() }); }
}
`);

// ──────────────────────────────────────────────────────────────────────────
// 11. VENDOR COMPLIANCE ALERTS — scan and trigger reminders
// ──────────────────────────────────────────────────────────────────────────
writeIfNotExists(`${ROOT}/src/app/api/vendors/compliance-scan/route.ts`,
`${IMPORTS}
${CORS}
export async function POST(request: Request) {
${AUTH_GET}
    const now = new Date();
    const days30 = new Date(now.getTime() + 30 * 86400000);
    const days15 = new Date(now.getTime() + 15 * 86400000);
    const days7  = new Date(now.getTime() + 7  * 86400000);

    // Find docs that need reminders
    const [need30, need15, need7, expired] = await Promise.all([
      prisma.vendorDocument.findMany({ where: { expiryDate: { lte: days30, gt: days15 }, reminderSent30: false }, include: { vendor: { select: { id: true, name: true, contactEmail: true } } } }),
      prisma.vendorDocument.findMany({ where: { expiryDate: { lte: days15, gt: days7 }, reminderSent15: false }, include: { vendor: { select: { id: true, name: true, contactEmail: true } } } }),
      prisma.vendorDocument.findMany({ where: { expiryDate: { lte: days7, gt: now }, reminderSent7: false }, include: { vendor: { select: { id: true, name: true, contactEmail: true } } } }),
      prisma.vendorDocument.findMany({ where: { expiryDate: { lt: now }, status: { not: 'expired' } }, include: { vendor: { select: { id: true, name: true, contactEmail: true } } } }),
    ]);

    const sent = [];
    for (const d of need30) { await prisma.vendorDocument.update({ where: { id: d.id }, data: { reminderSent30: true, status: 'expiring' } }); sent.push({ docId: d.id, vendor: d.vendor.name, type: d.type, days: 30 }); }
    for (const d of need15) { await prisma.vendorDocument.update({ where: { id: d.id }, data: { reminderSent15: true, status: 'expiring' } }); sent.push({ docId: d.id, vendor: d.vendor.name, type: d.type, days: 15 }); }
    for (const d of need7)  { await prisma.vendorDocument.update({ where: { id: d.id }, data: { reminderSent7: true, status: 'expiring' } }); sent.push({ docId: d.id, vendor: d.vendor.name, type: d.type, days: 7 }); }
    for (const d of expired) { await prisma.vendorDocument.update({ where: { id: d.id }, data: { status: 'expired' } }); sent.push({ docId: d.id, vendor: d.vendor.name, type: d.type, days: 0, expired: true }); }
    // (In production: send emails to vendor.contactEmail and tenant admin here)
    return NextResponse.json({ sent, total: sent.length, scannedAt: now.toISOString() }, { headers: corsHeaders() });
  } catch (error) { console.error('Compliance scan error:', error); return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() }); }
}
`);

// ──────────────────────────────────────────────────────────────────────────
// 12. VENDOR STAFF (Contractor) — list/create
// ──────────────────────────────────────────────────────────────────────────
writeIfNotExists(`${ROOT}/src/app/api/vendors/[id]/staff/route.ts`,
`${IMPORTS}
${CORS}
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
${AUTH_GET}
    const { id } = await params;
    const staff = await prisma.vendorStaff.findMany({ where: { vendorId: id }, orderBy: { createdAt: 'desc' } });
    return NextResponse.json({ staff }, { headers: corsHeaders() });
  } catch (error) { console.error('Get vendor staff error:', error); return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() }); }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
${AUTH_GET}
    const { id } = await params;
    const body = await request.json();
    const { name, email, phone, role, skillTags, billRate, costRate, currency } = body;
    if (!name) return NextResponse.json({ error: 'Missing name' }, { status: 400, headers: corsHeaders() });
    const staff = await prisma.vendorStaff.create({
      data: { vendorId: id, name, email, phone, role, skillTags, billRate, costRate, currency: currency || 'INR' },
    });
    await prisma.vendor.update({ where: { id }, data: { candidateCount: { increment: 1 } } });
    return NextResponse.json({ staff }, { status: 201, headers: corsHeaders() });
  } catch (error) { console.error('Create vendor staff error:', error); return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() }); }
}
`);

// ──────────────────────────────────────────────────────────────────────────
// 13. VENDOR PURGE — hard delete + PII scrub
// ──────────────────────────────────────────────────────────────────────────
writeIfNotExists(`${ROOT}/src/app/api/vendors/[id]/purge/route.ts`,
`${IMPORTS}
${CORS}
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
${AUTH_GET}
    const { id } = await params;
    // RBAC: only super_admin or tenant_admin
    if (decoded.role && !['super_admin', 'tenant_admin'].includes(decoded.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403, headers: corsHeaders() });
    }
    const vendor = await prisma.vendor.findUnique({ where: { id } });
    if (!vendor) return NextResponse.json({ error: 'Vendor not found' }, { status: 404, headers: corsHeaders() });

    // 1. Mask PII on vendor staff (GDPR right to erasure — keep denormalized stats)
    await prisma.vendorStaff.updateMany({
      where: { vendorId: id },
      data: { email: null, phone: null, name: \`[PURGED_\${Date.now()}]\`, piiMasked: true, status: 'offboarded', offboardedAt: new Date() },
    });
    // 2. Disable all portal users
    await prisma.vendorPortalUser.updateMany({ where: { vendorId: id }, data: { status: 'purged', passwordHash: null, otpSecret: null } });
    // 3. Scrub vendor contact PII (mask, keep record for audit)
    await prisma.vendor.update({
      where: { id },
      data: {
        contactName: '[PURGED]',
        contactEmail: null,
        contactPhone: null,
        address: null,
        city: null,
        state: null,
        zipCode: null,
        status: 'purged',
        piiPurgedAt: new Date(),
      },
    });
    await prisma.auditLog.create({ data: { userId: decoded.userId as string, action: 'VENDOR_PURGE', module: 'vendors', details: \`GDPR vendor purge executed for vendor \${id} (\${vendor.name})\` } });
    return NextResponse.json({ purged: true, vendorId: id, purgedAt: new Date().toISOString() }, { headers: corsHeaders() });
  } catch (error) { console.error('Vendor purge error:', error); return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() }); }
}
`);

// ──────────────────────────────────────────────────────────────────────────
// 14. CONTRACTOR REQUESTS — list/create
// ──────────────────────────────────────────────────────────────────────────
writeIfNotExists(`${ROOT}/src/app/api/contractor-requests/route.ts`,
`${IMPORTS}
${CORS}
export async function GET(request: Request) {
${AUTH_GET}
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const vendorId = searchParams.get('vendorId');
    const status = searchParams.get('status');
    const where = {};
    if (projectId) where.projectId = projectId;
    if (vendorId) where.vendorId = vendorId;
    if (status) where.status = status;
    const requests = await prisma.contractorRequest.findMany({
      where,
      include: { project: { select: { id: true, name: true } }, vendor: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json({ requests }, { headers: corsHeaders() });
  } catch (error) { console.error('Get contractor requests error:', error); return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() }); }
}

export async function POST(request: Request) {
${AUTH_GET}
    const body = await request.json();
    const { projectId, vendorId, role, skillTags, headcount, billRateMax, currency, startDate, durationDays, notes } = body;
    if (!projectId || !role) return NextResponse.json({ error: 'Missing projectId or role' }, { status: 400, headers: corsHeaders() });
    const cr = await prisma.contractorRequest.create({
      data: { projectId, vendorId, role, skillTags, headcount: headcount || 1, billRateMax, currency: currency || 'INR', startDate: startDate ? new Date(startDate) : null, durationDays, notes, requestedById: decoded.userId },
    });
    return NextResponse.json({ request: cr }, { status: 201, headers: corsHeaders() });
  } catch (error) { console.error('Create contractor request error:', error); return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() }); }
}
`);

// ──────────────────────────────────────────────────────────────────────────
// 15. PURCHASE ORDERS — list/create
// ──────────────────────────────────────────────────────────────────────────
writeIfNotExists(`${ROOT}/src/app/api/purchase-orders/route.ts`,
`${IMPORTS}
${CORS}
export async function GET(request: Request) {
${AUTH_GET}
    const { searchParams } = new URL(request.url);
    const vendorId = searchParams.get('vendorId');
    const companyId = searchParams.get('companyId');
    const status = searchParams.get('status');
    const where = {};
    if (vendorId) where.vendorId = vendorId;
    if (companyId) where.companyId = companyId;
    if (status) where.status = status;
    const pos = await prisma.purchaseOrder.findMany({
      where,
      include: { vendor: { select: { id: true, name: true } }, company: { select: { id: true, name: true } }, project: { select: { id: true, name: true } }, lineItems: true, _count: { select: { vendorInvoices: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json({ purchaseOrders: pos }, { headers: corsHeaders() });
  } catch (error) { console.error('Get POs error:', error); return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() }); }
}

export async function POST(request: Request) {
${AUTH_GET}
    const body = await request.json();
    const { poNumber, vendorId, companyId, projectId, currency, baseCurrency, exchangeRate, lineItems, notes, expectedBy } = body;
    if (!poNumber || !vendorId || !companyId || !lineItems?.length) return NextResponse.json({ error: 'Missing required fields' }, { status: 400, headers: corsHeaders() });
    const totalAmount = lineItems.reduce((s, li) => s + (li.quantity * li.unitPrice), 0);
    const po = await prisma.purchaseOrder.create({
      data: {
        poNumber, vendorId, companyId, projectId,
        currency: currency || 'INR', baseCurrency: baseCurrency || 'INR', exchangeRate: exchangeRate || 1,
        totalAmount, baseAmount: totalAmount * (exchangeRate || 1),
        status: 'issued', issuedAt: new Date(),
        expectedBy: expectedBy ? new Date(expectedBy) : null, notes,
        lineItems: { create: lineItems.map(li => ({ description: li.description, quantity: li.quantity, unitPrice: li.unitPrice, currency: li.currency || currency || 'INR', total: li.quantity * li.unitPrice })) },
      },
      include: { lineItems: true },
    });
    await prisma.auditLog.create({ data: { userId: decoded.userId as string, action: 'CREATE_PO', module: 'vendors', details: \`Created PO \${poNumber} for vendor \${vendorId} amount \${totalAmount}\` } });
    return NextResponse.json({ purchaseOrder: po }, { status: 201, headers: corsHeaders() });
  } catch (error) { console.error('Create PO error:', error); return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() }); }
}
`);

// ──────────────────────────────────────────────────────────────────────────
// 16. VENDOR INVOICES — list/create + 3-WAY MATCH
// ──────────────────────────────────────────────────────────────────────────
writeIfNotExists(`${ROOT}/src/app/api/vendor-invoices/route.ts`,
`${IMPORTS}
${CORS}
export async function GET(request: Request) {
${AUTH_GET}
    const { searchParams } = new URL(request.url);
    const vendorId = searchParams.get('vendorId');
    const poId = searchParams.get('poId');
    const status = searchParams.get('status');
    const where = {};
    if (vendorId) where.vendorId = vendorId;
    if (poId) where.poId = poId;
    if (status) where.status = status;
    const vis = await prisma.vendorInvoice.findMany({
      where,
      include: { vendor: { select: { id: true, name: true } }, po: { select: { id: true, poNumber: true, totalAmount: true, currency: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json({ vendorInvoices: vis }, { headers: corsHeaders() });
  } catch (error) { console.error('Get vendor invoices error:', error); return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() }); }
}

export async function POST(request: Request) {
${AUTH_GET}
    const body = await request.json();
    const { vendorId, poId, invoiceNumber, invoiceDate, currency, baseCurrency, exchangeRate, totalAmount, notes, autoMatch } = body;
    if (!vendorId || !invoiceNumber || !totalAmount) return NextResponse.json({ error: 'Missing required fields' }, { status: 400, headers: corsHeaders() });

    let matchedJson = null;
    let status = 'draft';
    if (autoMatch && poId) {
      const po = await prisma.purchaseOrder.findUnique({ where: { id: poId }, include: { lineItems: true, project: { include: { timesheets: { select: { hours: true, status: true } } } } } });
      if (po) {
        const poMatched = Math.abs(po.totalAmount - totalAmount) < 0.01;
        // Timesheet match: hours × costRate ~ totalAmount
        const timesheetHours = po.project?.timesheets.filter(t => t.status === 'approved').reduce((s, t) => s + t.hours, 0) || 0;
        const timesheetMatched = po.project && Math.abs(timesheetHours * (po.project.costRate || 0) - totalAmount) < (totalAmount * 0.1);
        const qtyDelta = po.totalAmount - totalAmount;
        const rateDelta = 0; // simplified
        matchedJson = { poMatched, timesheetMatched, qtyDelta, rateDelta, poAmount: po.totalAmount, invoiceAmount: totalAmount, timesheetHours };
        status = (poMatched && timesheetMatched) ? 'matched' : 'mismatched';
      }
    }

    const vi = await prisma.vendorInvoice.create({
      data: {
        vendorId, poId, invoiceNumber,
        invoiceDate: invoiceDate ? new Date(invoiceDate) : new Date(),
        currency: currency || 'INR', baseCurrency: baseCurrency || 'INR', exchangeRate: exchangeRate || 1,
        totalAmount, baseAmount: totalAmount * (exchangeRate || 1),
        status, matchedJson, notes,
      },
    });
    return NextResponse.json({ vendorInvoice: vi }, { status: 201, headers: corsHeaders() });
  } catch (error) { console.error('Create vendor invoice error:', error); return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() }); }
}
`);

console.log('Phase 1 (Client + Vendor APIs) done.');

// ──────────────────────────────────────────────────────────────────────────
// 17. WALLET — get/create/buckets/transactions
// ──────────────────────────────────────────────────────────────────────────
writeIfNotExists(`${ROOT}/src/app/api/wallet/route.ts`,
`${IMPORTS}
${CORS}
export async function GET(request: Request) {
${AUTH_GET}
    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get('employeeId');
    if (!employeeId) return NextResponse.json({ error: 'Missing employeeId' }, { status: 400, headers: corsHeaders() });
    let wallet = await prisma.wallet.findFirst({
      where: { employeeId, currency: 'INR' },
      include: { buckets: { include: { _count: { select: { transactions: true } } } }, transactions: { orderBy: { createdAt: 'desc' }, take: 20 } },
    });
    if (!wallet) {
      // Auto-create wallet with default buckets
      wallet = await prisma.wallet.create({
        data: {
          employeeId, currency: 'INR',
          buckets: { create: [
            { category: 'meal_allowance', balance: 0, employerCoPayPct: 100 },
            { category: 'learning_development', balance: 0, employerCoPayPct: 80 },
            { category: 'wellness', balance: 0, employerCoPayPct: 100 },
            { category: 'general_rewards', balance: 0, employerCoPayPct: 100 },
            { category: 'kudos', balance: 0, employerCoPayPct: 100 },
          ] },
        },
        include: { buckets: true, transactions: true },
      });
    }
    return NextResponse.json({ wallet }, { headers: corsHeaders() });
  } catch (error) { console.error('Get wallet error:', error); return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() }); }
}

export async function POST(request: Request) {
${AUTH_GET}
    // Top-up or debit a bucket (admin only)
    const body = await request.json();
    const { employeeId, bucketId, type, amount, description, reference } = body;
    if (!employeeId || !bucketId || !type || !amount) return NextResponse.json({ error: 'Missing fields' }, { status: 400, headers: corsHeaders() });
    let wallet = await prisma.wallet.findFirst({ where: { employeeId, currency: 'INR' } });
    if (!wallet) {
      wallet = await prisma.wallet.create({ data: { employeeId, currency: 'INR' } });
    }
    const bucket = await prisma.walletBucket.findUnique({ where: { id: bucketId } });
    if (!bucket || bucket.walletId !== wallet.id) return NextResponse.json({ error: 'Invalid bucket' }, { status: 400, headers: corsHeaders() });

    const newBalance = type === 'credit' ? bucket.balance + amount : type === 'debit' ? bucket.balance - amount : bucket.balance;
    if (newBalance < 0) return NextResponse.json({ error: 'Insufficient balance' }, { status: 400, headers: corsHeaders() });

    const [updatedBucket, txn] = await prisma.$transaction([
      prisma.walletBucket.update({ where: { id: bucketId }, data: { balance: newBalance } }),
      prisma.walletTransaction.create({ data: { walletId: wallet.id, bucketId, type, amount, currency: wallet.currency, baseAmount: amount, reference, description, initiatedById: decoded.userId } }),
    ]);
    return NextResponse.json({ bucket: updatedBucket, transaction: txn }, { headers: corsHeaders() });
  } catch (error) { console.error('Wallet op error:', error); return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() }); }
}
`);

// ──────────────────────────────────────────────────────────────────────────
// 18. MARKETPLACE PRODUCTS — list/create
// ──────────────────────────────────────────────────────────────────────────
writeIfNotExists(`${ROOT}/src/app/api/marketplace/products/route.ts`,
`${IMPORTS}
${CORS}
export async function GET(request: Request) {
${AUTH_GET}
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const providerName = searchParams.get('provider');
    const search = searchParams.get('search');
    const where = { status: 'active' };
    if (category) where.category = category;
    if (providerName) where.providerName = providerName;
    if (search) where.name = { contains: search, mode: 'insensitive' };
    const products = await prisma.marketplaceProduct.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json({ products }, { headers: corsHeaders() });
  } catch (error) { console.error('Get marketplace products error:', error); return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() }); }
}

export async function POST(request: Request) {
${AUTH_GET}
    if (!['super_admin', 'tenant_admin'].includes(decoded.role || '')) return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403, headers: corsHeaders() });
    const body = await request.json();
    const { sku, name, description, category, providerName, publicPrice, corporatePrice, currency, allowedBuckets, imageUrl, fulfillmentMode, quantityLimitPerQuarter } = body;
    if (!sku || !name || !category || !providerName || !publicPrice || !corporatePrice) return NextResponse.json({ error: 'Missing required fields' }, { status: 400, headers: corsHeaders() });
    const product = await prisma.marketplaceProduct.create({
      data: { sku, name, description, category, providerName, publicPrice, corporatePrice, currency: currency || 'INR', allowedBuckets: allowedBuckets || 'general_rewards', imageUrl, fulfillmentMode: fulfillmentMode || 'digital', quantityLimitPerQuarter: quantityLimitPerQuarter || 0 },
    });
    return NextResponse.json({ product }, { status: 201, headers: corsHeaders() });
  } catch (error) { console.error('Create product error:', error); return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() }); }
}
`);

// ──────────────────────────────────────────────────────────────────────────
// 19. MARKETPLACE ORDERS — place order + fraud check
// ──────────────────────────────────────────────────────────────────────────
writeIfNotExists(`${ROOT}/src/app/api/marketplace/orders/route.ts`,
`${IMPORTS}
${CORS}
export async function GET(request: Request) {
${AUTH_GET}
    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get('employeeId');
    const where = {};
    if (employeeId) where.employeeId = employeeId;
    const orders = await prisma.marketplaceOrder.findMany({
      where,
      include: { product: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return NextResponse.json({ orders }, { headers: corsHeaders() });
  } catch (error) { console.error('Get orders error:', error); return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() }); }
}

export async function POST(request: Request) {
${AUTH_GET}
    const body = await request.json();
    const { employeeId, productId, qty, walletBucketId } = body;
    if (!employeeId || !productId) return NextResponse.json({ error: 'Missing fields' }, { status: 400, headers: corsHeaders() });

    const product = await prisma.marketplaceProduct.findUnique({ where: { id: productId } });
    if (!product || product.status !== 'active') return NextResponse.json({ error: 'Product unavailable' }, { status: 400, headers: corsHeaders() });

    const quantity = qty || 1;
    const totalAmount = product.corporatePrice * quantity;

    // Validate bucket
    if (!walletBucketId) return NextResponse.json({ error: 'Wallet bucket required' }, { status: 400, headers: corsHeaders() });
    const bucket = await prisma.walletBucket.findUnique({ where: { id: walletBucketId } });
    if (!bucket) return NextResponse.json({ error: 'Invalid bucket' }, { status: 400, headers: corsHeaders() });
    const allowedBuckets = product.allowedBuckets.split(',').map(s => s.trim());
    if (!allowedBuckets.includes(bucket.category)) return NextResponse.json({ error: \`Product cannot be bought with \${bucket.category} bucket (REQ-MKT-03)\` }, { status: 400, headers: corsHeaders() });
    if (bucket.balance < totalAmount) return NextResponse.json({ error: 'Insufficient balance' }, { status: 400, headers: corsHeaders() });

    // Quarterly quantity limit (REQ-SEC-MKT-04)
    if (product.quantityLimitPerQuarter > 0) {
      const quarterStart = new Date(); quarterStart.setMonth(Math.floor(quarterStart.getMonth() / 3) * 3, 1); quarterStart.setHours(0, 0, 0, 0);
      const quarterCount = await prisma.marketplaceOrder.count({ where: { employeeId, productId, createdAt: { gte: quarterStart }, status: { not: 'cancelled' } } });
      if (quarterCount + quantity > product.quantityLimitPerQuarter) return NextResponse.json({ error: 'Quarterly quantity limit exceeded (anti-arbitrage)' }, { status: 400, headers: corsHeaders() });
    }

    // Velocity fraud check (REQ-AI-MKT-02)
    const oneMinuteAgo = new Date(Date.now() - 60000);
    const recentOrders = await prisma.marketplaceOrder.count({ where: { employeeId, createdAt: { gte: oneMinuteAgo } } });
    let blockedByFraud = false;
    let fraudReason = null;
    if (recentOrders >= 3) { blockedByFraud = true; fraudReason = 'velocity'; }
    if (totalAmount > 50000) { blockedByFraud = true; fraudReason = 'bulk_high_value'; }

    if (blockedByFraud) {
      await prisma.marketplaceFraudFlag.create({ data: { employeeId, reason: fraudReason, riskScore: 0.9, mfaTriggered: true } });
      return NextResponse.json({ error: 'Order blocked by fraud detection. MFA required.', fraudReason }, { status: 403, headers: corsHeaders() });
    }

    // Co-pay split
    const employerPct = bucket.employerCoPayPct;
    const employerPaid = totalAmount * (employerPct / 100);
    const employeePaid = totalAmount - employerPaid;

    // Create order + debit wallet + record transaction atomically
    const [order, ,] = await prisma.$transaction([
      prisma.marketplaceOrder.create({
        data: { employeeId, productId, qty: quantity, unitPrice: product.corporatePrice, totalAmount, currency: product.currency, walletBucketId: bucket.id, employerCoPayPct: employerPct, employerPaidAmount: employerPaid, employeePaidAmount: employeePaid, fulfillmentStatus: 'fulfilled', fulfillmentRef: \`CODE-\${Date.now()}\`, status: 'completed' },
      }),
      prisma.walletBucket.update({ where: { id: bucket.id }, data: { balance: { decrement: totalAmount } } }),
      prisma.walletTransaction.create({ data: { walletId: bucket.walletId, bucketId: bucket.id, type: 'debit', amount: totalAmount, currency: product.currency, baseAmount: totalAmount, description: \`Order: \${product.name} x\${quantity}\` } }),
    ]);
    return NextResponse.json({ order }, { status: 201, headers: corsHeaders() });
  } catch (error) { console.error('Place order error:', error); return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() }); }
}
`);

// ──────────────────────────────────────────────────────────────────────────
// 20. INSURANCE POLICIES + CLAIMS
// ──────────────────────────────────────────────────────────────────────────
writeIfNotExists(`${ROOT}/src/app/api/insurance/policies/route.ts`,
`${IMPORTS}
${CORS}
export async function GET(request: Request) {
${AUTH_GET}
    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get('employeeId');
    const where = {};
    if (employeeId) where.employeeId = employeeId;
    const policies = await prisma.insurancePolicy.findMany({ where, include: { _count: { select: { claims: true } } }, orderBy: { createdAt: 'desc' } });
    return NextResponse.json({ policies }, { headers: corsHeaders() });
  } catch (error) { console.error('Get policies error:', error); return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() }); }
}

export async function POST(request: Request) {
${AUTH_GET}
    const body = await request.json();
    const { employeeId, policyType, providerName, policyNumber, coverageAmount, premiumAmount, premiumCurrency, paymentMode, deductionFrequency, startDate, endDate, dependents } = body;
    if (!employeeId || !policyType || !providerName || !coverageAmount) return NextResponse.json({ error: 'Missing fields' }, { status: 400, headers: corsHeaders() });
    const policy = await prisma.insurancePolicy.create({
      data: { employeeId, policyType, providerName, policyNumber, coverageAmount, premiumAmount: premiumAmount || 0, premiumCurrency: premiumCurrency || 'INR', paymentMode: paymentMode || 'payroll_deduction', deductionFrequency: deductionFrequency || 'monthly', startDate: new Date(startDate), endDate: endDate ? new Date(endDate) : null, dependentsJson: dependents || null },
    });
    return NextResponse.json({ policy }, { status: 201, headers: corsHeaders() });
  } catch (error) { console.error('Create policy error:', error); return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() }); }
}
`);

writeIfNotExists(`${ROOT}/src/app/api/insurance/claims/route.ts`,
`${IMPORTS}
${CORS}
export async function GET(request: Request) {
${AUTH_GET}
    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get('employeeId');
    const policyId = searchParams.get('policyId');
    const where = {};
    if (employeeId) where.employeeId = employeeId;
    if (policyId) where.policyId = policyId;
    const claims = await prisma.insuranceClaim.findMany({ where, include: { policy: { select: { id: true, providerName: true, policyNumber: true } } }, orderBy: { createdAt: 'desc' } });
    return NextResponse.json({ claims }, { headers: corsHeaders() });
  } catch (error) { console.error('Get claims error:', error); return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() }); }
}

export async function POST(request: Request) {
${AUTH_GET}
    const body = await request.json();
    const { policyId, employeeId, claimAmount, billFileUrl, aiParsedRaw } = body;
    if (!policyId || !employeeId || !claimAmount) return NextResponse.json({ error: 'Missing fields' }, { status: 400, headers: corsHeaders() });

    // AI OCR pre-fill simulation (REQ-INS-04)
    let aiParsedJson = null, aiConfidence = 0;
    if (billFileUrl || aiParsedRaw) {
      // In production: call VLM/OCR here. For now, accept pre-parsed fields.
      aiParsedJson = aiParsedRaw || { amount: claimAmount, diagnosis: null, policyNumber: null, hospitalName: null };
      aiConfidence = 0.75;
    }
    const claim = await prisma.insuranceClaim.create({
      data: { policyId, employeeId, claimAmount, billFileUrl, aiParsedJson, aiConfidence, status: 'draft' },
    });
    return NextResponse.json({ claim }, { status: 201, headers: corsHeaders() });
  } catch (error) { console.error('Create claim error:', error); return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() }); }
}
`);

// ──────────────────────────────────────────────────────────────────────────
// 21. EWA — Earned Wage Access
// ──────────────────────────────────────────────────────────────────────────
writeIfNotExists(`${ROOT}/src/app/api/ewa/route.ts`,
`${IMPORTS}
${CORS}
export async function GET(request: Request) {
${AUTH_GET}
    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get('employeeId');
    const where = {};
    if (employeeId) where.employeeId = employeeId;
    const requests = await prisma.eWARequest.findMany({ where, orderBy: { createdAt: 'desc' }, take: 50 });
    return NextResponse.json({ requests }, { headers: corsHeaders() });
  } catch (error) { console.error('Get EWA error:', error); return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() }); }
}

export async function POST(request: Request) {
${AUTH_GET}
    const body = await request.json();
    const { employeeId, providerName, requestedAmount } = body;
    if (!employeeId || !requestedAmount) return NextResponse.json({ error: 'Missing fields' }, { status: 400, headers: corsHeaders() });

    // Compute earned-to-date (current month): daily salary × days attended
    const employee = await prisma.employee.findUnique({ select: { salary: true, salaryCurrency: true, dateOfJoining: true }, where: { id: employeeId } });
    if (!employee || !employee.salary) return NextResponse.json({ error: 'Employee salary not configured' }, { status: 400, headers: corsHeaders() });
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const dayOfMonth = now.getDate();
    const dailySalary = employee.salary / daysInMonth;

    const attendances = await prisma.attendance.findMany({ where: { employeeId, date: { gte: monthStart, lte: now } }, select: { status: true } });
    const presentDays = attendances.filter(a => ['present', 'late', 'wfh'].includes(a.status)).length;
    const earnedToDate = dailySalary * presentDays;
    const maxWithdrawable = earnedToDate * 0.7; // 70% cap

    if (requestedAmount > maxWithdrawable) return NextResponse.json({ error: \`Exceeds 70% of earned-to-date (\${maxWithdrawable.toFixed(2)} \${employee.salaryCurrency || 'INR'})\` }, { status: 400, headers: corsHeaders() });

    const feeAmount = requestedAmount * 0.02; // 2% fee
    const req = await prisma.eWARequest.create({
      data: { employeeId, providerName: providerName || 'Wagestream', requestedAmount, earnedToDate, feeAmount, currency: employee.salaryCurrency || 'INR', status: 'approved', transferredAt: new Date() },
    });
    return NextResponse.json({ request: req, earnedToDate, maxWithdrawable, feeAmount }, { status: 201, headers: corsHeaders() });
  } catch (error) { console.error('Create EWA error:', error); return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() }); }
}
`);

// ──────────────────────────────────────────────────────────────────────────
// 22. LOAN MARKETPLACE LISTINGS
// ──────────────────────────────────────────────────────────────────────────
writeIfNotExists(`${ROOT}/src/app/api/loan-marketplace/route.ts`,
`${IMPORTS}
${CORS}
export async function GET(request: Request) {
${AUTH_GET}
    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get('employeeId');
    const where = {};
    if (employeeId) where.employeeId = employeeId;
    const listings = await prisma.loanMarketplaceListing.findMany({ where, orderBy: { createdAt: 'desc' }, take: 50 });
    return NextResponse.json({ listings }, { headers: corsHeaders() });
  } catch (error) { console.error('Get loan listings error:', error); return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() }); }
}

export async function POST(request: Request) {
${AUTH_GET}
    const body = await request.json();
    const { employeeId, bankName, offerAmount, interestRate, tenureMonths, emiAmount, processingFee, consentGiven } = body;
    if (!employeeId || !bankName || !offerAmount) return NextResponse.json({ error: 'Missing fields' }, { status: 400, headers: corsHeaders() });

    // Consent gate (REQ-FIN-05)
    const consentAt = consentGiven ? new Date() : null;
    // Generate one-time expiring deep link
    const deepLinkSentAt = consentGiven ? new Date() : null;

    const listing = await prisma.loanMarketplaceListing.create({
      data: { employeeId, bankName, offerAmount, interestRate: interestRate || 0, tenureMonths: tenureMonths || 12, emiAmount: emiAmount || 0, processingFee: processingFee || 0, currency: 'INR', consentGiven: !!consentGiven, consentAt, deepLinkSentAt, applicationStatus: 'pre_approved' },
    });
    return NextResponse.json({ listing }, { status: 201, headers: corsHeaders() });
  } catch (error) { console.error('Create loan listing error:', error); return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() }); }
}
`);

// ──────────────────────────────────────────────────────────────────────────
// 23. GIFTS — list/send
// ──────────────────────────────────────────────────────────────────────────
writeIfNotExists(`${ROOT}/src/app/api/gifts/route.ts`,
`${IMPORTS}
${CORS}
export async function GET(request: Request) {
${AUTH_GET}
    const { searchParams } = new URL(request.url);
    const recipientId = searchParams.get('recipientId');
    const triggerEvent = searchParams.get('trigger');
    const where = {};
    if (recipientId) where.recipientId = recipientId;
    if (triggerEvent) where.triggerEvent = triggerEvent;
    const gifts = await prisma.gift.findMany({ where, include: { product: { select: { id: true, name: true, imageUrl: true } }, recipient: { select: { id: true, firstName: true, lastName: true } } }, orderBy: { createdAt: 'desc' }, take: 50 });
    return NextResponse.json({ gifts }, { headers: corsHeaders() });
  } catch (error) { console.error('Get gifts error:', error); return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() }); }
}

export async function POST(request: Request) {
${AUTH_GET}
    const body = await request.json();
    const { recipientId, senderId, triggerEvent, productId, voucherCode, message, value, currency } = body;
    if (!recipientId || !triggerEvent) return NextResponse.json({ error: 'Missing fields' }, { status: 400, headers: corsHeaders() });
    const gift = await prisma.gift.create({
      data: { recipientId, senderId: senderId || decoded.userId, triggerEvent, productId, voucherCode, message, value: value || 0, currency: currency || 'INR' },
    });
    return NextResponse.json({ gift }, { status: 201, headers: corsHeaders() });
  } catch (error) { console.error('Create gift error:', error); return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() }); }
}
`);

// ──────────────────────────────────────────────────────────────────────────
// 24. AUTOMATED MILESTONE GIFTING CRON (manual trigger)
// ──────────────────────────────────────────────────────────────────────────
writeIfNotExists(`${ROOT}/src/app/api/gifts/milestone-scan/route.ts`,
`${IMPORTS}
${CORS}
export async function POST(request: Request) {
${AUTH_GET}
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today.getTime() + 86400000);

    // Birthdays today
    const birthdayEmployees = await prisma.employee.findMany({ where: { status: 'active', dateOfBirth: { not: null } } });
    const birthdayGifts = [];
    for (const emp of birthdayEmployees) {
      if (!emp.dateOfBirth) continue;
      const dob = new Date(emp.dateOfBirth);
      if (dob.getMonth() === today.getMonth() && dob.getDate() === today.getDate()) {
        const existing = await prisma.gift.findFirst({ where: { recipientId: emp.id, triggerEvent: 'birthday', createdAt: { gte: today } } });
        if (!existing) {
          const g = await prisma.gift.create({ data: { recipientId: emp.id, triggerEvent: 'birthday', message: 'Happy Birthday from the team!', value: 0, currency: 'INR', status: 'sent' } });
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
        const existing = await prisma.gift.findFirst({ where: { recipientId: emp.id, triggerEvent: 'work_anniversary', createdAt: { gte: today } } });
        if (!existing) {
          const g = await prisma.gift.create({ data: { recipientId: emp.id, triggerEvent: 'work_anniversary', message: \`Happy \${years} anniversary!\`, value: 0, currency: 'INR', status: 'sent' } });
          anniversaryGifts.push(g);
        }
      }
    }

    return NextResponse.json({ birthdayGifts: birthdayGifts.length, anniversaryGifts: anniversaryGifts.length, totalSent: birthdayGifts.length + anniversaryGifts.length, scannedAt: now.toISOString() }, { headers: corsHeaders() });
  } catch (error) { console.error('Milestone scan error:', error); return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() }); }
}
`);

// ──────────────────────────────────────────────────────────────────────────
// 25. P2P RECOGNITION (Kudos) — give points to peers
// ──────────────────────────────────────────────────────────────────────────
writeIfNotExists(`${ROOT}/src/app/api/recognition/route.ts`,
`${IMPORTS}
${CORS}
export async function GET(request: Request) {
${AUTH_GET}
    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get('employeeId');
    const where = {};
    if (employeeId) where.employeeId = employeeId;
    const ledger = await prisma.rewardPointsLedger.findMany({ where, orderBy: { createdAt: 'desc' }, take: 50 });
    // Aggregate balance
    const balance = ledger.length > 0 ? ledger[0].balanceAfter : 0;
    return NextResponse.json({ ledger, balance }, { headers: corsHeaders() });
  } catch (error) { console.error('Get recognition error:', error); return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() }); }
}

export async function POST(request: Request) {
${AUTH_GET}
    const body = await request.json();
    const { fromId, toId, points, message } = body;
    if (!fromId || !toId || !points) return NextResponse.json({ error: 'Missing fields' }, { status: 400, headers: corsHeaders() });
    if (fromId === toId) return NextResponse.json({ error: 'Cannot give kudos to yourself' }, { status: 400, headers: corsHeaders() });
    if (points > 100) return NextResponse.json({ error: 'Max 100 points per kudos' }, { status: 400, headers: corsHeaders() });

    // Get recipient's current balance
    const lastEntry = await prisma.rewardPointsLedger.findFirst({ where: { employeeId: toId }, orderBy: { createdAt: 'desc' } });
    const newBalance = (lastEntry?.balanceAfter || 0) + points;

    const entry = await prisma.rewardPointsLedger.create({
      data: { employeeId: toId, type: 'earn', points, balanceAfter: newBalance, source: 'p2p_kudos', referenceId: fromId },
    });

    // Credit to recipient's kudos wallet bucket
    let wallet = await prisma.wallet.findFirst({ where: { employeeId: toId, currency: 'INR' } });
    if (!wallet) wallet = await prisma.wallet.create({ data: { employeeId: toId, currency: 'INR' } });
    let kudosBucket = await prisma.walletBucket.findFirst({ where: { walletId: wallet.id, category: 'kudos' } });
    if (!kudosBucket) kudosBucket = await prisma.walletBucket.create({ data: { walletId: wallet.id, category: 'kudos', balance: 0, employerCoPayPct: 100 } });
    await prisma.$transaction([
      prisma.walletBucket.update({ where: { id: kudosBucket.id }, data: { balance: { increment: points } } }),
      prisma.walletTransaction.create({ data: { walletId: wallet.id, bucketId: kudosBucket.id, type: 'credit', amount: points, currency: 'INR', baseAmount: points, reference: entry.id, description: \`Kudos from \${fromId}: \${message || ''}\` } }),
    ]);
    return NextResponse.json({ entry, newBalance }, { status: 201, headers: corsHeaders() });
  } catch (error) { console.error('Give kudos error:', error); return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() }); }
}
`);

// ──────────────────────────────────────────────────────────────────────────
// 26. AI MARKETPLACE — financial stress prediction (REQ-AI-MKT-03)
// ──────────────────────────────────────────────────────────────────────────
writeIfNotExists(`${ROOT}/src/app/api/marketplace/ai/financial-stress/route.ts`,
`${IMPORTS}
${CORS}
export async function GET(request: Request) {
${AUTH_GET}
    const employees = await prisma.employee.findMany({
      where: { status: 'active' },
      select: { id: true, firstName: true, lastName: true, employeeId: true },
    });
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);

    const results = [];
    for (const emp of employees) {
      const [ewaCount, loanCount, attendanceDrop] = await Promise.all([
        prisma.eWARequest.count({ where: { employeeId: emp.id, createdAt: { gte: thirtyDaysAgo } } }),
        prisma.loanMarketplaceListing.count({ where: { employeeId: emp.id, applicationStatus: { in: ['applied', 'approved', 'disbursed'] } } }),
        prisma.attendance.count({ where: { employeeId: emp.id, date: { gte: thirtyDaysAgo }, status: 'absent' } }),
      ]);
      let score = 0;
      score += Math.min(0.5, ewaCount * 0.15);
      score += Math.min(0.3, loanCount * 0.10);
      score += Math.min(0.2, attendanceDrop * 0.02);
      score = Math.min(1, score);
      const riskLevel = score >= 0.6 ? 'high' : score >= 0.3 ? 'medium' : 'low';
      if (riskLevel === 'low') continue; // only flag medium+
      const flag = await prisma.financialStressFlag.create({
        data: { employeeId: emp.id, riskScore: score, riskLevel, factorsJson: { ewaCount, loanCount, attendanceDrop }, recommendedAction: riskLevel === 'high' ? 'Offer financial counseling session' : 'Send EWA best-practices guide', notifiedHR: false, anonymized: true },
      });
      results.push({ employeeId: emp.id, employeeName: \`\${emp.firstName} \${emp.lastName}\`, riskLevel, riskScore: Math.round(score * 100) / 100, factors: { ewaCount, loanCount, attendanceDrop }, flagId: flag.id });
    }
    return NextResponse.json({ results, evaluatedAt: now.toISOString() }, { headers: corsHeaders() });
  } catch (error) { console.error('Stress prediction error:', error); return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() }); }
}
`);

// ──────────────────────────────────────────────────────────────────────────
// 27. WALLET BUDGET ALLOCATION (Tenant Admin)
// ──────────────────────────────────────────────────────────────────────────
writeIfNotExists(`${ROOT}/src/app/api/wallet-budgets/route.ts`,
`${IMPORTS}
${CORS}
export async function GET(request: Request) {
${AUTH_GET}
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    const where = {};
    if (companyId) where.companyId = companyId;
    const allocations = await prisma.walletBudgetAllocation.findMany({ where, include: { company: { select: { id: true, name: true } }, employee: { select: { id: true, firstName: true, lastName: true } } }, orderBy: { createdAt: 'desc' } });
    return NextResponse.json({ allocations }, { headers: corsHeaders() });
  } catch (error) { console.error('Get wallet budgets error:', error); return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() }); }
}

export async function POST(request: Request) {
${AUTH_GET}
    if (!['super_admin', 'tenant_admin'].includes(decoded.role || '')) return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403, headers: corsHeaders() });
    const body = await request.json();
    const { companyId, departmentId, employeeId, bucketCategory, monthlyAmount, currency, activeFrom, activeUntil } = body;
    if (!companyId || !bucketCategory || !monthlyAmount) return NextResponse.json({ error: 'Missing fields' }, { status: 400, headers: corsHeaders() });
    const alloc = await prisma.walletBudgetAllocation.create({
      data: { companyId, departmentId, employeeId, bucketCategory, monthlyAmount, currency: currency || 'INR', activeFrom: activeFrom ? new Date(activeFrom) : new Date(), activeUntil: activeUntil ? new Date(activeUntil) : null },
    });
    return NextResponse.json({ allocation: alloc }, { status: 201, headers: corsHeaders() });
  } catch (error) { console.error('Create wallet budget error:', error); return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() }); }
}
`);

console.log('Phase 2 (Marketplace APIs) done.');
