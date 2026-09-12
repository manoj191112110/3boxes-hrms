/**
 * Admin-only sample-data seeder.
 *
 * POST /api/admin/seed-sample-data
 *   Body: { module: "attendance" | "leave" | "invoice" | "optional-holidays" | "all" }
 *
 * Idempotent — uses upserts / findFirst-then-create patterns so re-running
 * the same module won't create duplicate rows.
 *
 * ⚠️ LIVE MODE GUARD: This endpoint is BLOCKED on the production platform.
 * Only works on the demo domain (nexus-hrms-mu.vercel.app).
 */
import { requireUser, isAdminRole, ok, fail, OPTIONS } from '@/lib/attendance-leave-api';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { isLiveMode } from '@/lib/site-mode';

export { OPTIONS };

export async function POST(request: Request) {
  // ─── LIVE MODE GUARD ───
  // Sample data seeding is STRICTLY PROHIBITED on the live platform.
  if (isLiveMode(request)) {
    return fail('Sample data seeding is disabled on the live platform. This feature is only available on the demo site (nexus-hrms-mu.vercel.app).', 403);
  }

  const db = await getDb(request);
  const { user, response } = await requireUser(request);
  if (!user) return response;
  if (!isAdminRole(user.role)) return fail('Admin only', 403);

  let body: { module?: string } = {};
  try { body = await request.json(); } catch { /* allow empty body = "all" */ }
  const module = body.module || 'all';

  const results: Record<string, { created: number; skipped: number; note?: string }> = {};

  try {
    // Pick a stable set of employees to seed against
    const employees = await db.employee.findMany({
      where: { status: 'active' },
      take: 10,
      orderBy: { createdAt: 'asc' },
    });
    if (employees.length === 0) return fail('No active employees found in DB', 400);

    const companies = await db.company.findMany({ take: 5 });
    if (companies.length === 0) return fail('No companies found in DB', 400);
    const company = companies[0];

    if (module === 'all' || module === 'attendance') {
      results.attendance = await seedAttendance(employees);
    }
    if (module === 'all' || module === 'leave') {
      results.leave = await seedLeave(employees);
    }
    if (module === 'all' || module === 'invoice') {
      results.invoice = await seedInvoices(company.id);
    }
    if (module === 'all' || module === 'optional-holidays') {
      results.optionalHolidays = await seedOptionalHolidays();
    }

    return ok({ results, seededFor: { employees: employees.length, company: company.name } });
  } catch (e: unknown) {
    return fail(e instanceof Error ? e.message : 'Seed failed', 500);
  }
}

// ────────────────────────────────────────────────────────────────────────────
// ATTENDANCE — 30 days of punches for the first 10 employees
// ────────────────────────────────────────────────────────────────────────────
async function seedAttendance(employees: { id: string; firstName: string; lastName: string }[]) {
  let created = 0;
  let skipped = 0;

  const today = new Date();
  for (let dayOffset = 29; dayOffset >= 0; dayOffset--) {
    const date = new Date(today);
    date.setDate(today.getDate() - dayOffset);
    date.setHours(0, 0, 0, 0);

    const dow = date.getDay();
    if (dow === 0 || dow === 6) continue; // skip weekends

    for (const emp of employees) {
      // Skip if attendance already exists for this employee+date
      const existing = await db.attendance.findFirst({
        where: { employeeId: emp.id, date },
        select: { id: true },
      });
      if (existing) { skipped++; continue; }

      // Random status — 80% present, 10% late, 5% half_day, 5% absent
      const r = Math.random();
      let status = 'present';
      let checkIn: Date | null = new Date(date);
      let checkOut: Date | null = new Date(date);
      let workHours: number | null = null;
      let overtime: number | null = null;

      if (r < 0.05) {
        status = 'absent';
        checkIn = null;
        checkOut = null;
      } else if (r < 0.15) {
        status = 'late';
        checkIn.setHours(10, 30 + Math.floor(Math.random() * 30), 0, 0);
        checkOut.setHours(19, 0 + Math.floor(Math.random() * 30), 0, 0);
        workHours = 8.5;
      } else if (r < 0.20) {
        status = 'half_day';
        checkIn.setHours(9, 15, 0, 0);
        checkOut.setHours(13, 30, 0, 0);
        workHours = 4.0;
      } else {
        checkIn.setHours(9, Math.floor(Math.random() * 20), 0, 0);
        checkOut.setHours(18, Math.floor(Math.random() * 40) - 10, 0, 0);
        workHours = 8.5 + Math.random() * 1.5;
        if (Math.random() < 0.15) overtime = Math.round((Math.random() * 2) * 10) / 10;
      }

      if (status !== 'absent' && checkIn && checkOut) {
        workHours = workHours ?? 8.5;
      }

      await db.attendance.create({
        data: {
          employeeId: emp.id,
          date,
          checkIn,
          checkOut,
          status,
          workHours: workHours ?? 0,
          overtime: overtime ?? 0,
          location: Math.random() < 0.3 ? 'WFH' : 'Office HQ',
          notes: status === 'late' ? 'Traffic delay' : null,
        },
      });
      created++;
    }
  }
  return { created, skipped };
}

// ────────────────────────────────────────────────────────────────────────────
// LEAVE — leave types, balances, requests
// ────────────────────────────────────────────────────────────────────────────
async function seedLeave(employees: { id: string }[]) {
  let created = 0;
  let skipped = 0;
  const year = new Date().getFullYear();

  // Leave types — upsert by code
  const leaveTypes = [
    { name: 'Casual Leave', code: 'CL', defaultDays: 12, isPaid: true, carryForward: true, maxCarryForward: 6, encashmentAllowed: false },
    { name: 'Sick Leave', code: 'SL', defaultDays: 12, isPaid: true, carryForward: true, maxCarryForward: 12, encashmentAllowed: false, attachmentMandatory: true, attachmentMandatoryAfterDays: 2 },
    { name: 'Earned Leave', code: 'EL', defaultDays: 15, isPaid: true, carryForward: true, maxCarryForward: 30, encashmentAllowed: true, encashmentBasis: 'basic', maxEncashmentDays: 30 },
    { name: 'Maternity Leave', code: 'ML', defaultDays: 84, isPaid: true, carryForward: false, encashmentAllowed: false },
    { name: 'Paternity Leave', code: 'PL', defaultDays: 5, isPaid: true, carryForward: false, encashmentAllowed: false },
    { name: 'Marriage Leave', code: 'MRL', defaultDays: 3, isPaid: true, carryForward: false, encashmentAllowed: false },
    { name: 'Bereavement Leave', code: 'BL', defaultDays: 3, isPaid: true, carryForward: false, encashmentAllowed: false },
  ];

  const ltIds: Record<string, string> = {};
  for (const lt of leaveTypes) {
    const existing = await db.leaveType.findUnique({ where: { code: lt.code } });
    if (existing) { ltIds[lt.code] = existing.id; skipped++; continue; }
    const created_lt = await db.leaveType.create({
      data: {
        name: lt.name,
        code: lt.code,
        defaultDays: lt.defaultDays,
        isPaid: lt.isPaid,
        carryForward: lt.carryForward,
        maxCarryForward: lt.maxCarryForward,
        encashmentAllowed: lt.encashmentAllowed,
        encashmentBasis: lt.encashmentBasis || 'basic',
        maxEncashmentDays: lt.maxEncashmentDays || 0,
        attachmentMandatory: lt.attachmentMandatory || false,
        attachmentMandatoryAfterDays: lt.attachmentMandatoryAfterDays || 0,
        status: 'active',
      },
    });
    ltIds[lt.code] = created_lt.id;
    created++;
  }

  // Leave balances for first 8 employees × 3 main leave types
  const balanceCodes = ['CL', 'SL', 'EL'];
  for (const emp of employees.slice(0, 8)) {
    for (const code of balanceCodes) {
      const ltId = ltIds[code];
      if (!ltId) continue;
      const existing = await db.leaveBalance.findFirst({
        where: { employeeId: emp.id, leaveTypeId: ltId, year },
      });
      if (existing) { skipped++; continue; }
      const lt = leaveTypes.find(t => t.code === code)!;
      const total = lt.defaultDays;
      const used = Math.floor(Math.random() * (total / 2));
      await db.leaveBalance.create({
        data: {
          employeeId: emp.id,
          leaveTypeId: ltId,
          year,
          total,
          used,
          remaining: total - used,
          carryForward: 0,
        },
      });
      created++;
    }
  }

  // Sample leave requests (mix of statuses)
  const sampleRequests = [
    { code: 'CL', days: 2, reason: 'Personal work', status: 'approved', offset: -10 },
    { code: 'SL', days: 1, reason: 'Fever', status: 'approved', offset: -5 },
    { code: 'EL', days: 5, reason: 'Family vacation', status: 'pending', offset: 14 },
    { code: 'CL', days: 1, reason: 'Bank work', status: 'pending', offset: 7 },
    { code: 'SL', days: 3, reason: 'Medical procedure', status: 'approved', offset: -20 },
    { code: 'EL', days: 2, reason: 'Long weekend', status: 'rejected', offset: -3 },
  ];
  for (const req of sampleRequests) {
    const ltId = ltIds[req.code];
    if (!ltId) continue;
    const emp = employees[Math.floor(Math.random() * Math.min(5, employees.length))];
    const startDate = new Date();
    startDate.setDate(startDate.getDate() + req.offset);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + req.days - 1);

    const existing = await db.leaveRequest.findFirst({
      where: { employeeId: emp.id, startDate, leaveTypeId: ltId },
    });
    if (existing) { skipped++; continue; }

    await db.leaveRequest.create({
      data: {
        employeeId: emp.id,
        leaveTypeId: ltId,
        startDate,
        endDate,
        reason: req.reason,
        status: req.status,
        halfDay: false,
        approvedBy: req.status === 'approved' ? 'admin' : null,
        approvedAt: req.status === 'approved' ? new Date() : null,
        comments: req.status === 'rejected' ? 'Conflicts with project deadline' : null,
      },
    });
    created++;
  }

  return { created, skipped };
}

// ────────────────────────────────────────────────────────────────────────────
// INVOICES — 6 sample invoices in INR with line items
// ────────────────────────────────────────────────────────────────────────────
async function seedInvoices(companyId: string) {
  let created = 0;
  let skipped = 0;

  // Find or create a sample client
  let client = await db.client.findFirst({ where: { companyId } });
  if (!client) {
    client = await db.client.create({
      data: { name: 'Acme Industries', code: 'ACME-001', companyId, contactEmail: 'accounts@acme-industries.com', billingCurrency: 'INR' },
    });
    created++;
  }

  // Find or create a sample project
  let project = await db.project.findFirst({ where: { companyId } });
  if (!project) {
    project = await db.project.create({
      data: {
        name: 'HRMS Implementation',
        code: 'HRMS-IMP-001',
        companyId,
        clientId: client.id,
        status: 'active',
        projectType: 'client',
        billingType: 'time_and_material',
        currency: 'INR',
        budgetAmount: 1500000,
        estimatedHours: 800,
        billingRate: 2500,
        costRate: 1500,
        startDate: new Date(new Date().getFullYear(), 0, 1),
        progress: 35,
        description: 'End-to-end HRMS implementation for Acme Industries',
      },
    });
    created++;
  }

  const samples = [
    { num: 'INV-2026-001', type: 'timesheet', status: 'paid', issueOffset: -60, dueOffset: -30, subtotal: 450000, tax: 81000 },
    { num: 'INV-2026-002', type: 'milestone', status: 'paid', issueOffset: -45, dueOffset: -15, subtotal: 750000, tax: 135000 },
    { num: 'INV-2026-003', type: 'timesheet', status: 'sent', issueOffset: -20, dueOffset: 10, subtotal: 380000, tax: 68400 },
    { num: 'INV-2026-004', type: 'retainer', status: 'sent', issueOffset: -10, dueOffset: 20, subtotal: 250000, tax: 45000 },
    { num: 'INV-2026-005', type: 'timesheet', status: 'issued', issueOffset: -5, dueOffset: 25, subtotal: 290000, tax: 52200 },
    { num: 'INV-2026-006', type: 'fixed', status: 'draft', issueOffset: -1, dueOffset: 29, subtotal: 1200000, tax: 216000 },
  ];

  for (const s of samples) {
    const existing = await db.invoice.findUnique({ where: { invoiceNumber: s.num } });
    if (existing) { skipped++; continue; }

    const issueDate = new Date();
    issueDate.setDate(issueDate.getDate() + s.issueOffset);
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + s.dueOffset);
    const total = s.subtotal + s.tax;

    const inv = await db.invoice.create({
      data: {
        invoiceNumber: s.num,
        companyId,
        clientId: client.id,
        projectId: project.id,
        invoiceType: s.type,
        billingType: s.type === 'retainer' ? 'retainer' : s.type === 'fixed' ? 'fixed' : 'time_and_material',
        currency: 'INR',
        baseCurrency: 'INR',
        exchangeRate: 1,
        fxRateDate: new Date(),
        fxSource: 'MANUAL',
        subtotal: s.subtotal,
        taxRate: 18,
        taxAmount: s.tax,
        discountRate: 0,
        discountAmount: 0,
        totalAmount: total,
        subtotalBase: s.subtotal,
        totalAmountBase: total,
        issueDate,
        dueDate,
        periodStart: new Date(issueDate.getTime() - 30 * 86400000),
        periodEnd: issueDate,
        status: s.status,
        notes: 'Thank you for your business. Pay via bank transfer to HDFC A/c 0123456789012.',
        internalNotes: 'Sample invoice for demo',
        createdBy: 'admin',
        issuedBy: s.status !== 'draft' ? 'admin' : null,
        issuedAt: s.status !== 'draft' ? issueDate : null,
        paidAt: s.status === 'paid' ? new Date(issueDate.getTime() + 5 * 86400000) : null,
        paymentRef: s.status === 'paid' ? `BANK-REF-${s.num}` : null,
      },
    });

    // Add 2-3 line items per invoice
    const items = s.type === 'retainer'
      ? [{ desc: 'Monthly Retainer — Managed Services', qty: 1, rate: s.subtotal, hours: 0 }]
      : s.type === 'fixed'
      ? [{ desc: 'Project Delivery — Phase 1', qty: 1, rate: s.subtotal, hours: 0 }]
      : [
        { desc: 'Senior Consultant — Dev Lead', qty: 80, rate: 2500, hours: 80 },
        { desc: 'Senior Developer', qty: 80, rate: 1800, hours: 80 },
        { desc: 'QA Engineer', qty: 40, rate: 1200, hours: 40 },
      ];

    for (const item of items) {
      const amount = item.qty * item.rate;
      await db.invoiceLineItem.create({
        data: {
          invoiceId: inv.id,
          sourceType: s.type === 'timesheet' ? 'timesheet' : 'manual',
          projectId: project.id,
          description: item.desc,
          date: issueDate,
          hours: item.hours,
          quantity: item.qty,
          unit: s.type === 'retainer' || s.type === 'fixed' ? 'units' : 'hours',
          rate: item.rate,
          rateSourceCurrency: 'INR',
          rateSourceAmount: item.rate,
          fxRate: 1,
          amount,
          amountBase: amount,
          taxable: true,
        },
      });
    }
    created++;
  }
  return { created, skipped };
}

// ────────────────────────────────────────────────────────────────────────────
// OPTIONAL HOLIDAYS — mark a few holidays as optional for festival election
// ────────────────────────────────────────────────────────────────────────────
async function seedOptionalHolidays() {
  let created = 0;
  let skipped = 0;
  const year = new Date().getFullYear();

  const optionalHolidays = [
    { name: 'Onam', date: new Date(year, 8, 5), country: 'India', description: 'Harvest festival of Kerala', quota: 2 },
    { name: 'Pongal', date: new Date(year, 0, 14), country: 'India', description: 'Tamil harvest festival', quota: 2 },
    { name: 'Baisakhi', date: new Date(year, 3, 13), country: 'India', description: 'Punjabi new year festival', quota: 2 },
    { name: 'Rath Yatra', date: new Date(year, 6, 7), country: 'India', description: 'Puri Jagannath chariot festival', quota: 2 },
    { name: 'Maha Shivaratri', date: new Date(year, 2, 8), country: 'India', description: 'Festival honoring Lord Shiva', quota: 2 },
  ];

  for (const h of optionalHolidays) {
    const existing = await db.holiday.findFirst({ where: { name: h.name, date: h.date } });
    if (existing) {
      if (!existing.isOptional) {
        await db.holiday.update({ where: { id: existing.id }, data: { isOptional: true, optionalQuota: h.quota } });
        created++;
      } else { skipped++; }
      continue;
    }
    await db.holiday.create({
      data: {
        name: h.name,
        date: h.date,
        type: 'festival',
        country: h.country,
        description: h.description,
        isOptional: true,
        optionalQuota: h.quota,
      },
    });
    created++;
  }
  return { created, skipped };
}
