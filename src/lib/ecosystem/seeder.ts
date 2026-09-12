/**
 * Shared ecosystem seeder library — used by:
 *   1. /api/admin/seed-ecosystem-data  (admin-triggered, full re-seed)
 *   2. /api/auto-seed-demo              (public, idempotent auto-seed-on-first-load)
 *
 * Both endpoints call the same functions so behaviour is consistent.
 *
 * Functions:
 *   - seedClients(companyId, projects, employees)
 *   - seedVendors(companyId, projects, employees)
 *   - seedMarketplace(companyId, employees)
 *   - seedWellness(companyId, employees)
 *   - seedCollaboration(companyId, employees)  — chat rooms + files + calls
 *
 * Each is idempotent — re-running won't duplicate rows.
 */
import prisma from '@/lib/prisma';

export type SeedEmployee = { id: string; firstName: string; lastName: string; email: string; dateOfJoining: Date | null };
export type SeedProject = { id: string; name: string };
export type SeedResult = { created: number; skipped: number; note?: string };

// ────────────────────────────────────────────────────────────────────────────
// HELPERS
// ────────────────────────────────────────────────────────────────────────────
function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(10, 0, 0, 0);
  return d;
}
function daysFromNow(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(10, 0, 0, 0);
  return d;
}

// ────────────────────────────────────────────────────────────────────────────
// CLIENTS — Section 8.1 / REQ-CLT-01..09 / REQ-AI-CLT-01..02
// ────────────────────────────────────────────────────────────────────────────
export async function seedClients(companyId: string, projects: { id: string; name: string }[], employees: { id: string; firstName: string; lastName: string; email: string; dateOfJoining: Date | null }[]) {
  let created = 0;
  let skipped = 0;

  // ─── 8 corporate clients with global → regional hierarchy ───
  const clientSpecs = [
    { name: 'Acme Global Holdings', code: 'ACME-GLB', industry: 'Conglomerate', website: 'https://acme-global.example', country: 'United States', currency: 'USD', terms: 'net_45', value: 4_500_000, branchCountry: 'United Kingdom', branchCurrency: 'GBP' },
    { name: 'Microsoft Corporation', code: 'MSFT-GLB', industry: 'Technology', website: 'https://microsoft.example', country: 'United States', currency: 'USD', terms: 'net_60', value: 8_200_000, branchCountry: 'India', branchCurrency: 'INR' },
    { name: 'Tesco PLC', code: 'TSCO-GLB', industry: 'Retail', website: 'https://tesco.example', country: 'United Kingdom', currency: 'GBP', terms: 'net_30', value: 1_850_000, branchCountry: 'India', branchCurrency: 'INR' },
    { name: 'Deutsche Bank AG', code: 'DBK-GLB', industry: 'Financial Services', website: 'https://db.example', country: 'Germany', currency: 'EUR', terms: 'net_30', value: 3_400_000, branchCountry: 'Singapore', branchCurrency: 'SGD' },
    { name: 'Reliance Industries', code: 'RIL-GLB', industry: 'Energy & Telecom', website: 'https://ril.example', country: 'India', currency: 'INR', terms: 'net_30', value: 2_750_000, branchCountry: 'United Arab Emirates', branchCurrency: 'AED' },
    { name: 'Singtel Group', code: 'SGT-GLB', industry: 'Telecommunications', website: 'https://singtel.example', country: 'Singapore', currency: 'SGD', terms: 'net_45', value: 1_950_000, branchCountry: 'Australia', branchCurrency: 'AUD' },
    { name: "Lloyd's of London", code: 'LLD-GLB', industry: 'Insurance', website: 'https://lloyds.example', country: 'United Kingdom', currency: 'GBP', terms: 'net_60', value: 5_100_000, branchCountry: 'India', branchCurrency: 'INR' },
    { name: 'Maersk Line', code: 'MAER-GLB', industry: 'Shipping & Logistics', website: 'https://maersk.example', country: 'Denmark', currency: 'EUR', terms: 'net_30', value: 2_300_000, branchCountry: 'India', branchCurrency: 'INR' },
  ];

  for (const spec of clientSpecs) {
    // Idempotent: find by code (unique within company scope is implied)
    let client = await prisma.client.findFirst({
      where: { companyId, code: spec.code },
    });
    if (client) {
      skipped++;
    } else {
      client = await prisma.client.create({
        data: {
          companyId,
          name: spec.name,
          code: spec.code,
          industry: spec.industry,
          website: spec.website,
          contactName: `${spec.name.split(' ')[0]} Procurement`,
          contactEmail: `procurement@${spec.code.toLowerCase().replace('-', '.')}.example`,
          contactPhone: '+1-555-0100',
          address: `${spec.country} HQ`,
          city: spec.country === 'India' ? 'Mumbai' : 'New York',
          state: spec.country === 'India' ? 'Maharashtra' : 'NY',
          country: spec.country,
          zipCode: '00001',
          billingCurrency: spec.currency,
          paymentTerms: spec.terms,
          contractStart: new Date('2026-01-01'),
          contractEnd: new Date('2027-12-31'),
          contractValue: spec.value,
          status: 'active',
        },
      });
      created++;
    }

    // ─── Client branch (regional sub-office) [REQ-CLT-01] ───
    const branchCode = `${spec.code}-BR`;
    const existingBranch = await prisma.clientBranch.findFirst({
      where: { clientId: client.id, name: { contains: spec.branchCountry } },
    });
    if (!existingBranch) {
      await prisma.clientBranch.create({
        data: {
          clientId: client.id,
          name: `${spec.name.split(' ')[0]} ${spec.branchCountry}`,
          companyId,
          country: spec.branchCountry,
          billingCurrency: spec.branchCurrency,
          paymentTerms: spec.terms,
          taxId: `TAX-${spec.code}-${Math.floor(Math.random() * 90000 + 10000)}`,
        },
      });
      created++;
    } else skipped++;

    // ─── Client contacts matrix [REQ-CLT-03] ───
    const contactRoles = [
      { role: 'Executive Sponsor', lang: 'en', primary: true },
      { role: 'Project Manager', lang: 'en', primary: false },
      { role: 'Finance Controller', lang: 'en', primary: false },
      { role: 'HR Business Partner', lang: 'en', primary: false },
    ];
    for (const cr of contactRoles) {
      const existing = await prisma.clientContact.findFirst({
        where: { clientId: client.id, role: cr.role },
      });
      if (existing) { skipped++; continue; }
      await prisma.clientContact.create({
        data: {
          clientId: client.id,
          name: `${cr.role.split(' ')[0]} ${spec.name.split(' ')[0]}`,
          email: `${cr.role.split(' ')[0].toLowerCase()}@${spec.code.toLowerCase().replace('-', '.')}.example`,
          phone: '+1-555-0200',
          role: cr.role,
          preferredLanguage: cr.lang,
          isPrimary: cr.primary,
        },
      });
      created++;
    }

    // ─── SOWs (some AI-parsed, some approved) [REQ-CLT-04 / REQ-CLT-05] ───
    const sowTitle = `SOW 2026 — ${spec.name.split(' ')[0]} Engagement`;
    const existingSow = await prisma.sOW.findFirst({ where: { clientId: client.id, title: sowTitle } });
    if (existingSow) {
      skipped++;
    } else {
      const sowStatus = Math.random() > 0.4 ? 'approved' : (Math.random() > 0.5 ? 'ai_parsed' : 'pending');
      const linkedProject = sowStatus === 'approved' && projects.length > 0
        ? projects[Math.floor(Math.random() * projects.length)]
        : null;
      await prisma.sOW.create({
        data: {
          clientId: client.id,
          projectId: linkedProject?.id || null,
          title: sowTitle,
          fileName: `${spec.code}-SOW-2026.pdf`,
          fileUrl: `https://cdn.example/sows/${spec.code}-SOW-2026.pdf`,
          rawText: `Statement of Work between ${spec.name} and Marq AI Tech Pvt Ltd for the year 2026. ...`,
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-12-31'),
          maxHeadcount: 12 + Math.floor(Math.random() * 30),
          billRatesJson: {
            developer: 65 + Math.floor(Math.random() * 30),
            senior_developer: 95 + Math.floor(Math.random() * 30),
            qa: 45 + Math.floor(Math.random() * 15),
            project_manager: 120 + Math.floor(Math.random() * 30),
            architect: 145 + Math.floor(Math.random() * 30),
          },
          milestonesJson: [
            { name: 'Kickoff & Discovery', date: '2026-02-15', amount: 100_000 },
            { name: 'Phase 1 Delivery', date: '2026-05-30', amount: 350_000 },
            { name: 'Phase 2 Delivery', date: '2026-09-15', amount: 450_000 },
            { name: 'Go-Live & Hypercare', date: '2026-12-15', amount: 200_000 },
          ],
          totalValue: spec.value,
          currency: spec.currency,
          status: sowStatus,
          approvedById: sowStatus === 'approved' ? employees[0].id : null,
          approvedAt: sowStatus === 'approved' ? daysAgo(20) : null,
          aiConfidence: sowStatus === 'ai_parsed' || sowStatus === 'approved' ? 0.85 + Math.random() * 0.13 : null,
        },
      });
      created++;
    }

    // ─── Client Portal Users [REQ-CLT-06 / REQ-SEC-CV-04] ───
    const portalEmail = `portaluser@${spec.code.toLowerCase().replace('-', '.')}.example`;
    const existingPortal = await prisma.clientPortalUser.findFirst({ where: { clientId: client.id, email: portalEmail } });
    if (existingPortal) {
      skipped++;
    } else {
      await prisma.clientPortalUser.create({
        data: {
          clientId: client.id,
          email: portalEmail,
          name: `${spec.name.split(' ')[0]} Portal User`,
          mfaEnabled: true,
          preferredLanguage: 'en',
          lastLoginAt: daysAgo(Math.floor(Math.random() * 14)),
          status: 'active',
        },
      });
      created++;
    }

    // ─── AI Churn Risk [REQ-AI-CLT-01] ───
    const existingRisk = await prisma.clientChurnRisk.findFirst({ where: { clientId: client.id } });
    if (existingRisk) {
      skipped++;
    } else {
      const riskScore = Math.random();
      const riskLevel = riskScore > 0.66 ? 'high' : riskScore > 0.33 ? 'medium' : 'low';
      await prisma.clientChurnRisk.create({
        data: {
          clientId: client.id,
          riskScore,
          riskLevel,
          factorsJson: {
            invoice_delay_days: Math.floor(riskScore * 60),
            nps_score: Math.floor(10 - riskScore * 9),
            senior_churn_pct: Math.floor(riskScore * 40),
            margin_compression_pct: Math.floor(riskScore * 15),
            milestone_overrun_pct: Math.floor(riskScore * 25),
          },
          recommendations: riskLevel === 'high'
            ? 'Schedule executive escalation within 7 days. Review pricing model and consider a strategic discount on the renewal SOW.'
            : 'Maintain regular quarterly business reviews. No immediate action required.',
          notifiedManager: riskLevel === 'high',
          evaluatedAt: daysAgo(Math.floor(Math.random() * 5)),
        },
      });
      created++;
    }

    // ─── AI Margin Snapshot [REQ-AI-CLT-02] ───
    if (projects.length > 0) {
      const projectForMargin = projects[Math.floor(Math.random() * projects.length)];
      const existingMargin = await prisma.clientMarginSnapshot.findFirst({
        where: { clientId: client.id, projectId: projectForMargin.id },
      });
      if (existingMargin) {
        skipped++;
      } else {
        const revenue = spec.value * 0.4;
        const costEmp = revenue * 0.55;
        const costVen = revenue * 0.10;
        const gross = revenue - costEmp - costVen;
        await prisma.clientMarginSnapshot.create({
          data: {
            clientId: client.id,
            projectId: projectForMargin.id,
            revenueBase: revenue,
            costEmployee: costEmp,
            costVendor: costVen,
            grossMargin: gross,
            marginPct: gross / revenue,
            currency: spec.currency,
            snapshotAt: daysAgo(Math.floor(Math.random() * 10)),
          },
        });
        created++;
      }
    }
  }

  // ─── Client timesheet approvals [REQ-CLT-08] — sample 5 across clients ───
  const clientsForApproval = await prisma.client.findMany({ where: { companyId }, take: 5 });
  const timesheetsForApproval = await prisma.timesheet.findMany({ take: 5 });
  for (let i = 0; i < clientsForApproval.length && i < timesheetsForApproval.length; i++) {
    const existing = await prisma.clientTimesheetApproval.findFirst({
      where: { timesheetId: timesheetsForApproval[i].id },
    });
    if (existing) { skipped++; continue; }
    await prisma.clientTimesheetApproval.create({
      data: {
        clientId: clientsForApproval[i].id,
        timesheetId: timesheetsForApproval[i].id,
        status: ['pending', 'approved', 'rejected'][i % 3],
        approvedAt: i % 3 === 1 ? daysAgo(2) : null,
        comments: i % 3 === 2 ? 'Hours logged on weekend — please clarify with team.' : null,
      },
    });
    created++;
  }

  return { created, skipped, note: '8 clients + branches + contacts + SOWs + portal users + churn risk + margin snapshots + timesheet approvals' };
}

// ────────────────────────────────────────────────────────────────────────────
// VENDORS — Section 8.2 / REQ-VEN-01..10 / REQ-ECO-04..07
// ────────────────────────────────────────────────────────────────────────────
export async function seedVendors(companyId: string, projects: { id: string; name: string }[], employees: { id: string; firstName: string; lastName: string; email: string }[]) {
  let created = 0;
  let skipped = 0;

  // ─── Vendor Categories [REQ-VEN-01] ───
  const categories = [
    { name: 'Staffing Agency', description: 'Recruitment & contract staffing providers' },
    { name: 'Background Check Provider', description: 'BGV services (criminal, education, employment)' },
    { name: 'IT Hardware Vendor', description: 'Laptops, peripherals, networking gear' },
    { name: 'Benefits Administrator', description: 'Health insurance, retirement plan administrators' },
    { name: 'Cloud Infrastructure', description: 'AWS, Azure, GCP resellers & MSPs' },
    { name: 'Facilities & Security', description: 'Office housekeeping, physical security agencies' },
  ];
  for (const c of categories) {
    const existing = await prisma.vendorCategory.findFirst({ where: { name: c.name } });
    if (existing) { skipped++; continue; }
    await prisma.vendorCategory.create({ data: c });
    created++;
  }

  // ─── 8 vendors with mixed types, statuses, countries ───
  const vendorSpecs = [
    { name: 'StaffFirst Consulting', code: 'SF-V', type: 'vendor', industry: 'Staffing', country: 'India', currency: 'INR', special: 'IT contract staffing', cat: 'Staffing Agency' },
    { name: 'TalentPro Solutions', code: 'TP-V', type: 'vendor', industry: 'Staffing', country: 'India', currency: 'INR', special: 'Volume hiring', cat: 'Staffing Agency' },
    { name: 'HireRight BGV', code: 'HR-V', type: 'vendor', industry: 'Background Verification', country: 'United States', currency: 'USD', special: 'Global BGV', cat: 'Background Check Provider' },
    { name: 'SkillBridge Tech', code: 'SB-V', type: 'vendor', industry: 'Staffing', country: 'India', currency: 'INR', special: 'Niche skills (AI/ML, blockchain)', cat: 'Staffing Agency' },
    { name: 'PeopleFirst Benefits', code: 'PF-V', type: 'vendor', industry: 'Insurance Broking', country: 'India', currency: 'INR', special: 'Group health & life insurance', cat: 'Benefits Administrator' },
    { name: 'Dell Technologies India', code: 'DELL-V', type: 'vendor', industry: 'IT Hardware', country: 'India', currency: 'INR', special: 'Laptops, servers, workstations', cat: 'IT Hardware Vendor' },
    { name: 'AWS Reseller CloudPro', code: 'AWSCP-V', type: 'vendor', industry: 'Cloud', country: 'Singapore', currency: 'SGD', special: 'AWS managed services', cat: 'Cloud Infrastructure' },
    { name: 'SecureGuard Services', code: 'SG-V', type: 'vendor', industry: 'Physical Security', country: 'India', currency: 'INR', special: 'Manned guarding, CCTV monitoring', cat: 'Facilities & Security' },
  ];

  for (const spec of vendorSpecs) {
    let vendor = await prisma.vendor.findFirst({ where: { companyId, code: spec.code } });
    if (vendor) {
      skipped++;
    } else {
      vendor = await prisma.vendor.create({
        data: {
          companyId,
          name: spec.name,
          code: spec.code,
          type: spec.type,
          industry: spec.industry,
          website: `https://${spec.code.toLowerCase().replace('-', '')}.example`,
          contactName: `${spec.name.split(' ')[0]} Account Mgr`,
          contactEmail: `accounts@${spec.code.toLowerCase().replace('-', '')}.example`,
          contactPhone: '+91-9876543210',
          address: `${spec.country} HQ`,
          city: spec.country === 'India' ? 'Bengaluru' : 'Singapore',
          state: spec.country === 'India' ? 'Karnataka' : '—',
          country: spec.country,
          zipCode: '560001',
          specialization: spec.special,
          candidateCount: 50 + Math.floor(Math.random() * 200),
          rating: 3.5 + Math.random() * 1.5,
          status: Math.random() > 0.1 ? 'active' : 'suspended',
        },
      });
      created++;
    }

    // ─── Compliance documents [REQ-VEN-02 / REQ-VEN-03] ───
    const docSpecs = [
      { name: 'General Liability Insurance 2026', type: 'insurance', offsetDays: 220 },
      { name: 'Data Processing Agreement', type: 'dpa', offsetDays: 12 },     // expiring soon
      { name: 'Labour License (Karnataka)', type: 'labor_license', offsetDays: 75 },
      { name: 'Mutual NDA', type: 'nda', offsetDays: 400 },
      { name: 'ISO 27001 Certificate', type: 'iso', offsetDays: 5 },          // expired / critical
    ];
    for (const ds of docSpecs) {
      const existing = await prisma.vendorDocument.findFirst({ where: { vendorId: vendor.id, name: ds.name } });
      if (existing) { skipped++; continue; }
      const expiry = daysFromNow(ds.offsetDays);
      const status = ds.offsetDays < 0 ? 'expired' : ds.offsetDays <= 15 ? 'expiring' : 'valid';
      await prisma.vendorDocument.create({
        data: {
          vendorId: vendor.id,
          name: ds.name,
          type: ds.type,
          fileUrl: `https://cdn.example/vendors/${vendor.id}/${ds.type}.pdf`,
          issuedAt: daysAgo(180),
          expiryDate: expiry,
          status,
          uploadedById: employees[0].id,
        },
      });
      created++;
    }

    // ─── Vendor Staff (contractor bench) [REQ-VEN-04] ───
    const skillPool = ['Java', 'Python', 'React', 'AWS', 'DevOps', 'QA Automation', 'Data Engineering', 'Salesforce', 'Node.js', 'Spring Boot'];
    const roles = ['Software Engineer', 'Senior Engineer', 'Tech Lead', 'QA Engineer', 'DevOps Engineer'];
    const staffCount = 3 + Math.floor(Math.random() * 4);
    for (let i = 0; i < staffCount; i++) {
      const email = `staff${i + 1}@${spec.code.toLowerCase().replace('-', '')}.example`;
      const existing = await prisma.vendorStaff.findFirst({ where: { vendorId: vendor.id, email } });
      if (existing) { skipped++; continue; }
      const status = ['available', 'submitted', 'onboarded', 'offboarded'][Math.floor(Math.random() * 4)];
      await prisma.vendorStaff.create({
        data: {
          vendorId: vendor.id,
          name: `Candidate ${i + 1} (${spec.code})`,
          email,
          phone: `+91-${9000000000 + Math.floor(Math.random() * 999999999)}`,
          role: roles[i % roles.length],
          skillTags: [skillPool[i % skillPool.length], skillPool[(i + 3) % skillPool.length]].join(','),
          billRate: 60 + Math.floor(Math.random() * 80),
          costRate: 40 + Math.floor(Math.random() * 60),
          currency: spec.currency,
          onboardedAt: status === 'onboarded' || status === 'offboarded' ? daysAgo(60) : null,
          offboardedAt: status === 'offboarded' ? daysAgo(5) : null,
          status,
          piiMasked: status === 'available' || status === 'submitted',
        },
      });
      created++;
    }

    // ─── Vendor Portal Users [REQ-VEN-05 / REQ-SEC-CV-04] ───
    const portalEmail = `portal@${spec.code.toLowerCase().replace('-', '')}.example`;
    const existingPortal = await prisma.vendorPortalUser.findFirst({ where: { vendorId: vendor.id, email: portalEmail } });
    if (existingPortal) {
      skipped++;
    } else {
      await prisma.vendorPortalUser.create({
        data: {
          vendorId: vendor.id,
          email: portalEmail,
          name: `${spec.name.split(' ')[0]} Portal User`,
          mfaEnabled: true,
          canSubmitCandidates: true,
          lastLoginAt: daysAgo(Math.floor(Math.random() * 10)),
          status: 'active',
        },
      });
      created++;
    }
  }

  // ─── Contractor Requests [REQ-VEN-04] — link vendors to projects ───
  const vendors = await prisma.vendor.findMany({ where: { companyId }, take: 5 });
  if (projects.length >= 2 && vendors.length >= 2) {
    for (let i = 0; i < Math.min(projects.length, vendors.length, 6); i++) {
      const existing = await prisma.contractorRequest.findFirst({
        where: { projectId: projects[i].id, vendorId: vendors[i].id, role: `Contractor Role ${i + 1}` },
      });
      if (existing) { skipped++; continue; }
      await prisma.contractorRequest.create({
        data: {
          projectId: projects[i].id,
          requestedById: employees[0].id,
          vendorId: vendors[i].id,
          role: `Contractor Role ${i + 1}`,
          skillTags: ['React', 'Python', 'Java', 'AWS', 'DevOps', 'QA'][i % 6],
          headcount: 1 + (i % 3),
          billRateMax: 80 + i * 10,
          currency: 'INR',
          startDate: daysFromNow(14),
          durationDays: 90 + i * 30,
          status: ['open', 'submitted', 'fulfilled', 'open'][i % 4],
          notes: `SOW-driven contractor requisition for ${projects[i].name}.`,
        },
      });
      created++;
    }
  }

  // ─── Purchase Orders + Line Items [REQ-VEN-08] ───
  const poSpecs = [
    { poNumber: 'PO-2026-001', vendorIdx: 0, status: 'issued', total: 450_000, items: [{ desc: 'Senior React Developer — 3 months', qty: 3, price: 150_000 }] },
    { poNumber: 'PO-2026-002', vendorIdx: 1, status: 'received', total: 220_000, items: [{ desc: 'Volume hiring drive — Q1', qty: 1, price: 220_000 }] },
    { poNumber: 'PO-2026-003', vendorIdx: 2, status: 'partially_received', total: 12_500, items: [{ desc: 'Global BGV package — 100 candidates', qty: 100, price: 125 }] },
    { poNumber: 'PO-2026-004', vendorIdx: 3, status: 'draft', total: 540_000, items: [{ desc: 'AI/ML specialist — 6 months', qty: 2, price: 270_000 }] },
    { poNumber: 'PO-2026-005', vendorIdx: 5, status: 'closed', total: 1_800_000, items: [{ desc: 'Dell Latitude laptops (qty 60)', qty: 60, price: 30_000 }] },
    { poNumber: 'PO-2026-006', vendorIdx: 6, status: 'issued', total: 85_000, items: [{ desc: 'AWS Managed Cloud — monthly', qty: 6, price: 14_167 }] },
  ];
  for (const ps of poSpecs) {
    const existingPO = await prisma.purchaseOrder.findFirst({ where: { poNumber: ps.poNumber } });
    if (existingPO) { skipped++; continue; }
    if (!vendors[ps.vendorIdx]) continue;
    const po = await prisma.purchaseOrder.create({
      data: {
        poNumber: ps.poNumber,
        vendorId: vendors[ps.vendorIdx].id,
        companyId,
        projectId: projects[ps.vendorIdx % Math.max(projects.length, 1)]?.id || null,
        currency: vendors[ps.vendorIdx].country === 'India' ? 'INR' : 'USD',
        baseCurrency: 'INR',
        exchangeRate: vendors[ps.vendorIdx].country === 'India' ? 1 : 83,
        totalAmount: ps.total,
        baseAmount: ps.total * (vendors[ps.vendorIdx].country === 'India' ? 1 : 83),
        status: ps.status,
        issuedAt: ps.status !== 'draft' ? daysAgo(15) : null,
        expectedBy: daysFromNow(30),
        notes: `Auto-generated PO for ${vendors[ps.vendorIdx].name}.`,
        lineItems: {
          create: ps.items.map(it => ({
            description: it.desc,
            quantity: it.qty,
            unitPrice: it.price,
            currency: vendors[ps.vendorIdx].country === 'India' ? 'INR' : 'USD',
            total: it.qty * it.price,
            matchedQty: ps.status === 'received' || ps.status === 'closed' ? it.qty : (ps.status === 'partially_received' ? it.qty * 0.5 : 0),
          })),
        },
      },
    });
    created++;

    // ─── Vendor Invoices [REQ-VEN-09 / REQ-VEN-10] with 3-way matching ───
    if (ps.status !== 'draft') {
      const invNumber = `INV-${ps.poNumber.split('-').pop()}-2026`;
      const existingInv = await prisma.vendorInvoice.findFirst({ where: { invoiceNumber: invNumber } });
      if (existingInv) {
        skipped++;
      } else {
        const matched = ps.status === 'received' || ps.status === 'closed';
        const matchedJson = {
          poMatched: true,
          timesheetMatched: matched,
          qtyDelta: matched ? 0 : (Math.random() - 0.5) * 2,
          rateDelta: matched ? 0 : (Math.random() - 0.5) * 10,
        };
        await prisma.vendorInvoice.create({
          data: {
            vendorId: vendors[ps.vendorIdx].id,
            poId: po.id,
            invoiceNumber: invNumber,
            invoiceDate: daysAgo(7),
            currency: vendors[ps.vendorIdx].country === 'India' ? 'INR' : 'USD',
            baseCurrency: 'INR',
            exchangeRate: vendors[ps.vendorIdx].country === 'India' ? 1 : 83,
            totalAmount: ps.total,
            baseAmount: ps.total * (vendors[ps.vendorIdx].country === 'India' ? 1 : 83),
            status: matched ? 'paid' : (ps.status === 'partially_received' ? 'mismatched' : 'approved'),
            matchedJson,
            paidAt: matched ? daysAgo(2) : null,
            notes: matched ? '3-way match successful — auto-approved for payment.' : 'Quantity mismatch detected — manual review required.',
          },
        });
        created++;
      }
    }
  }

  return { created, skipped, note: '6 categories + 8 vendors + 40 documents + ~30 staff + portal users + 6 contractor reqs + 6 POs + 5 vendor invoices (3-way matched)' };
}

// ────────────────────────────────────────────────────────────────────────────
// MARKETPLACE — Section 9.1, 9.2, 9.4 / REQ-MKT-01..09 / REQ-SHP-01..05 / REQ-AI-MKT-01..02
// ────────────────────────────────────────────────────────────────────────────
export async function seedMarketplace(companyId: string, employees: { id: string; firstName: string; lastName: string; email: string }[]) {
  let created = 0;
  let skipped = 0;

  // ─── Marketplace Providers (vendor app store) [REQ-SHP-01] ───
  const providers = [
    { name: 'Sodexo', type: 'shopping', apiBaseUrl: 'https://api.sodexo.example', apiKeyMasked: 'sk_***sdx' },
    { name: 'Xoxoday', type: 'gift', apiBaseUrl: 'https://api.xoxoday.example', apiKeyMasked: 'sk_***xox' },
    { name: 'Amazon Business', type: 'shopping', apiBaseUrl: 'https://api.amazonbusiness.example', apiKeyMasked: 'sk_***amz' },
    { name: 'Plum', type: 'gift', apiBaseUrl: 'https://api.plum.example', apiKeyMasked: 'sk_***plm' },
    { name: 'Wagestream', type: 'ewa', apiBaseUrl: 'https://api.wagestream.example', apiKeyMasked: 'sk_***wgs' },
    { name: 'EarnIn', type: 'ewa', apiBaseUrl: 'https://api.earnin.example', apiKeyMasked: 'sk_***ern' },
    { name: 'HDFC Life', type: 'insurance', apiBaseUrl: 'https://api.hdfclife.example', apiKeyMasked: 'sk_***hdf' },
    { name: 'ICICI Lombard', type: 'insurance', apiBaseUrl: 'https://api.icicilombard.example', apiKeyMasked: 'sk_***ici' },
    { name: 'UpGrad', type: 'shopping', apiBaseUrl: 'https://api.upgrad.example', apiKeyMasked: 'sk_***upg' },
    { name: 'Coursera for Business', type: 'shopping', apiBaseUrl: 'https://api.coursera.example', apiKeyMasked: 'sk_***crg' },
  ];
  for (const p of providers) {
    const existing = await prisma.marketplaceProvider.findFirst({ where: { name: p.name } });
    if (existing) { skipped++; continue; }
    await prisma.marketplaceProvider.create({
      data: { ...p, superAdminApproved: true, status: 'active' },
    });
    created++;
  }

  // ─── Marketplace Products (catalog) [REQ-SHP-02] ───
  const products = [
    { sku: 'SODEXO-MEAL-500', name: 'Sodexo Meal Card — ₹500', category: 'voucher', provider: 'Sodexo', pub: 500, corp: 470, buckets: 'meal_allowance', mode: 'digital', limit: 4 },
    { sku: 'SODEXO-MEAL-1000', name: 'Sodexo Meal Card — ₹1000', category: 'voucher', provider: 'Sodexo', pub: 1000, corp: 940, buckets: 'meal_allowance', mode: 'digital', limit: 4 },
    { sku: 'AMZN-GC-500', name: 'Amazon Pay Gift Card — ₹500', category: 'gift_card', provider: 'Amazon Business', pub: 500, corp: 485, buckets: 'general_rewards,gift', mode: 'digital', limit: 6 },
    { sku: 'AMZN-GC-2000', name: 'Amazon Pay Gift Card — ₹2000', category: 'gift_card', provider: 'Amazon Business', pub: 2000, corp: 1940, buckets: 'general_rewards,gift', mode: 'digital', limit: 3 },
    { sku: 'XOXODY-BOOKS-300', name: 'Xoxoday Books Voucher — ₹300', category: 'gift_card', provider: 'Xoxoday', pub: 300, corp: 290, buckets: 'learning_development,general_rewards', mode: 'digital', limit: 4 },
    { sku: 'UPGRAD-COURSE-DS', name: 'UpGrad Data Science Certification', category: 'course', provider: 'UpGrad', pub: 65000, corp: 52000, buckets: 'learning_development', mode: 'api_redirect', limit: 1 },
    { sku: 'COURSERA-PMP', name: 'Coursera PMP Specialization', category: 'course', provider: 'Coursera for Business', pub: 12000, corp: 9800, buckets: 'learning_development', mode: 'api_redirect', limit: 1 },
    { sku: 'PLUM-WELLNESS-1000', name: 'Plum Wellness Spa Voucher — ₹1000', category: 'voucher', provider: 'Plum', pub: 1000, corp: 950, buckets: 'wellness,general_rewards', mode: 'digital', limit: 2 },
    { sku: 'PLUM-WELLNESS-2000', name: 'Plum Wellness Retreat — ₹2000', category: 'voucher', provider: 'Plum', pub: 2000, corp: 1900, buckets: 'wellness', mode: 'digital', limit: 1 },
    { sku: 'AMZN-LAPTOP-BAG', name: 'Amazon Basics Laptop Bag', category: 'physical_goods', provider: 'Amazon Business', pub: 1800, corp: 1450, buckets: 'general_rewards', mode: 'physical', limit: 1 },
    { sku: 'AMZN-HEADSET', name: 'Jabra Evolve 65 Headset', category: 'physical_goods', provider: 'Amazon Business', pub: 12000, corp: 10500, buckets: 'general_rewards', mode: 'physical', limit: 1 },
    { sku: 'SODEXO-MEAL-200', name: 'Sodexo Meal Card — ₹200', category: 'voucher', provider: 'Sodexo', pub: 200, corp: 188, buckets: 'meal_allowance', mode: 'digital', limit: 6 },
    { sku: 'XOXODY-STREAM-3M', name: 'Xoxoday Streaming Subscription — 3 months', category: 'digital_goods', provider: 'Xoxoday', pub: 1500, corp: 1350, buckets: 'general_rewards', mode: 'digital', limit: 1 },
    { sku: 'PLUM-FITNESS-3000', name: 'Plum Fitness Membership — Quarterly', category: 'voucher', provider: 'Plum', pub: 3000, corp: 2700, buckets: 'wellness', mode: 'digital', limit: 1 },
    { sku: 'AMZN-GC-5000', name: 'Amazon Pay Gift Card — ₹5000', category: 'gift_card', provider: 'Amazon Business', pub: 5000, corp: 4825, buckets: 'general_rewards,gift', mode: 'digital', limit: 1 },
  ];
  for (const p of products) {
    const existing = await prisma.marketplaceProduct.findFirst({ where: { sku: p.sku } });
    if (existing) { skipped++; continue; }
    await prisma.marketplaceProduct.create({
      data: {
        sku: p.sku,
        name: p.name,
        description: `${p.name} — corporate discounted price ₹${p.corp} (MRP ₹${p.pub}).`,
        category: p.category,
        providerName: p.provider,
        providerSku: `${p.sku}-P`,
        publicPrice: p.pub,
        corporatePrice: p.corp,
        currency: 'INR',
        allowedBuckets: p.buckets,
        imageUrl: `https://cdn.example/products/${p.sku}.png`,
        fulfillmentMode: p.mode,
        quantityLimitPerQuarter: p.limit,
        status: 'active',
      },
    });
    created++;
  }

  // ─── Wallets + Buckets + Transactions [REQ-MKT-01..04] ───
  // Multi-bucket, multi-currency wallets for first 15 employees
  const walletTemplate = [
    { category: 'meal_allowance', balance: 2200, coPay: 100, exempt: 2200, expDays: 30 },
    { category: 'learning_development', balance: 15000, coPay: 80, exempt: null, expDays: 180 },
    { category: 'wellness', balance: 3500, coPay: 70, exempt: 5000, expDays: 90 },
    { category: 'general_rewards', balance: 1800, coPay: 100, exempt: 5000, expDays: 120 },
    { category: 'kudos', balance: 250, coPay: 100, exempt: null, expDays: 365 },
    { category: 'gift', balance: 1000, coPay: 100, exempt: 5000, expDays: 60 },
  ];
  // Also seed one USD wallet for the first employee (multi-currency demo)
  for (let i = 0; i < Math.min(15, employees.length); i++) {
    const emp = employees[i];
    // INR wallet
    let wallet = await prisma.wallet.findUnique({ where: { employeeId_currency: { employeeId: emp.id, currency: 'INR' } } });
    if (!wallet) {
      wallet = await prisma.wallet.create({
        data: { employeeId: emp.id, currency: 'INR' },
      });
      created++;
    } else skipped++;

    for (const b of walletTemplate) {
      // Vary balances a bit per employee
      const bal = i % 4 === 0 ? b.balance * 0.5 : i % 4 === 1 ? b.balance * 1.2 : b.balance;
      let bucket = await prisma.walletBucket.findUnique({
        where: { walletId_category: { walletId: wallet.id, category: b.category } },
      });
      if (bucket) { skipped++; continue; }
      bucket = await prisma.walletBucket.create({
        data: {
          walletId: wallet.id,
          category: b.category,
          balance: bal,
          employerCoPayPct: b.coPay,
          taxExemptLimit: b.exempt,
          expiresAt: b.expDays ? daysFromNow(b.expDays) : null,
        },
      });
      created++;

      // Credit transaction (monthly top-up)
      const existingTx = await prisma.walletTransaction.findFirst({
        where: { bucketId: bucket.id, type: 'credit', description: 'Monthly employer top-up' },
      });
      if (existingTx) { skipped++; continue; }
      await prisma.walletTransaction.create({
        data: {
          walletId: wallet.id,
          bucketId: bucket.id,
          type: 'credit',
          amount: bal + 500,
          currency: 'INR',
          baseAmount: bal + 500,
          reference: `topup-${emp.id}-${b.category}-${daysAgo(15).toISOString().substring(0, 7)}`,
          description: 'Monthly employer top-up',
          initiatedById: emp.id,
          createdAt: daysAgo(15),
        },
      });
      created++;

      // A debit transaction for ~half the bucket (showing usage)
      if (bal > 200) {
        await prisma.walletTransaction.create({
          data: {
            walletId: wallet.id,
            bucketId: bucket.id,
            type: 'debit',
            amount: bal * 0.4,
            currency: 'INR',
            baseAmount: bal * 0.4,
            reference: `order-${emp.id}-${b.category}`,
            description: `Catalog purchase from ${b.category} bucket`,
            initiatedById: emp.id,
            createdAt: daysAgo(7),
          },
        });
        created++;
      }
    }

    // One USD wallet for the first 3 employees (multi-currency)
    if (i < 3) {
      let usdWallet = await prisma.wallet.findUnique({ where: { employeeId_currency: { employeeId: emp.id, currency: 'USD' } } });
      if (!usdWallet) {
        usdWallet = await prisma.wallet.create({
          data: { employeeId: emp.id, currency: 'USD' },
        });
        created++;
        const usdBucket = await prisma.walletBucket.create({
          data: {
            walletId: usdWallet.id,
            category: 'general_rewards',
            balance: 150,
            employerCoPayPct: 100,
            taxExemptLimit: null,
            expiresAt: daysFromNow(90),
          },
        });
        created++;
        await prisma.walletTransaction.create({
          data: {
            walletId: usdWallet.id,
            bucketId: usdBucket.id,
            type: 'credit',
            amount: 200,
            currency: 'USD',
            baseAmount: 200 * 83,
            description: 'Quarterly USD bonus',
            initiatedById: emp.id,
            createdAt: daysAgo(20),
          },
        });
        created++;
      } else skipped++;
    }
  }

  // ─── Marketplace Orders [REQ-SHP-03 / REQ-SHP-04] ───
  const allProducts = await prisma.marketplaceProduct.findMany({ take: 15 });
  const sampleBuckets = await prisma.walletBucket.findMany({ take: 10 });
  for (let i = 0; i < 12 && i < employees.length; i++) {
    const prod = allProducts[i % allProducts.length];
    const existing = await prisma.marketplaceOrder.findFirst({
      where: { employeeId: employees[i].id, productId: prod.id },
    });
    if (existing) { skipped++; continue; }
    const qty = 1 + (i % 3);
    const unit = prod.corporatePrice;
    const total = unit * qty;
    const bucket = sampleBuckets[i % sampleBuckets.length];
    const employerPaid = total * (bucket.employerCoPayPct / 100);
    const empPaid = total - employerPaid;
    const status = i % 5 === 4 ? 'cancelled' : 'completed';
    await prisma.marketplaceOrder.create({
      data: {
        employeeId: employees[i].id,
        productId: prod.id,
        qty,
        unitPrice: unit,
        totalAmount: total,
        currency: prod.currency,
        walletBucketId: bucket.id,
        employerCoPayPct: bucket.employerCoPayPct,
        employerPaidAmount: employerPaid,
        employeePaidAmount: empPaid,
        fulfillmentStatus: status === 'completed' ? 'fulfilled' : 'failed',
        fulfillmentRef: status === 'completed' ? `GC-${Math.floor(Math.random() * 1e9)}` : null,
        blockedByFraud: false,
        status,
        createdAt: daysAgo(i + 1),
      },
    });
    created++;
  }

  // ─── Fraud Flag [REQ-AI-MKT-02] — one suspicious bulk order ───
  const fraudEmp = employees[0];
  const existingFraud = await prisma.marketplaceFraudFlag.findFirst({ where: { employeeId: fraudEmp.id, reason: 'bulk_high_value' } });
  if (existingFraud) {
    skipped++;
  } else {
    await prisma.marketplaceFraudFlag.create({
      data: {
        employeeId: fraudEmp.id,
        reason: 'bulk_high_value',
        riskScore: 0.87,
        mfaTriggered: true,
      },
    });
    created++;
  }

  // ─── Wallet Budget Allocations (tenant admin budget policy) ───
  const budgetSpecs = [
    { bucket: 'meal_allowance', amount: 2200 },
    { bucket: 'learning_development', amount: 15000 },
    { bucket: 'wellness', amount: 3500 },
    { bucket: 'general_rewards', amount: 1800 },
  ];
  for (const b of budgetSpecs) {
    const existing = await prisma.walletBudgetAllocation.findFirst({
      where: { companyId, bucketCategory: b.bucket, employeeId: null },
    });
    if (existing) { skipped++; continue; }
    await prisma.walletBudgetAllocation.create({
      data: {
        companyId,
        bucketCategory: b.bucket,
        monthlyAmount: b.amount,
        currency: 'INR',
        activeFrom: new Date('2026-01-01'),
        activeUntil: new Date('2026-12-31'),
      },
    });
    created++;
  }

  return {
    created,
    skipped,
    note: '10 providers + 15 products + 15 multi-currency wallets (6 buckets each) + ~180 transactions + 12 orders + 1 fraud flag + 4 budget allocations',
  };
}

// ────────────────────────────────────────────────────────────────────────────
// WELLNESS — Section 9.3 / REQ-FIN-01..06 / REQ-INS-01..05 / REQ-GFT-01..03
// ────────────────────────────────────────────────────────────────────────────
export async function seedWellness(companyId: string, employees: { id: string; firstName: string; lastName: string; email: string; dateOfJoining: Date | null }[]) {
  let created = 0;
  let skipped = 0;

  // ─── Insurance Policies [REQ-INS-01 / REQ-INS-05] ───
  // Base group_health for every employee (synced from HR) + voluntary top-ups for ~half
  for (let i = 0; i < employees.length; i++) {
    const emp = employees[i];
    // Base health
    const existingBase = await prisma.insurancePolicy.findFirst({
      where: { employeeId: emp.id, policyType: 'group_health', providerName: 'ICICI Lombard' },
    });
    if (existingBase) {
      skipped++;
    } else {
      await prisma.insurancePolicy.create({
        data: {
          employeeId: emp.id,
          policyType: 'group_health',
          providerName: 'ICICI Lombard',
          policyNumber: `GLB-HLTH-${String(i + 1).padStart(5, '0')}`,
          coverageAmount: 500_000,
          premiumAmount: 12_000,
          premiumCurrency: 'INR',
          paymentMode: 'payroll_deduction',
          deductionFrequency: 'monthly',
          startDate: emp.dateOfJoining || new Date('2026-01-01'),
          endDate: null,
          dependentsJson: i % 2 === 0 ? { spouse: true, children: 1 } : undefined,
          status: 'active',
        },
      });
      created++;
    }

    // Base life
    const existingLife = await prisma.insurancePolicy.findFirst({
      where: { employeeId: emp.id, policyType: 'group_life', providerName: 'HDFC Life' },
    });
    if (existingLife) {
      skipped++;
    } else {
      await prisma.insurancePolicy.create({
        data: {
          employeeId: emp.id,
          policyType: 'group_life',
          providerName: 'HDFC Life',
          policyNumber: `GLB-LIFE-${String(i + 1).padStart(5, '0')}`,
          coverageAmount: 1_000_000,
          premiumAmount: 3_500,
          premiumCurrency: 'INR',
          paymentMode: 'payroll_deduction',
          deductionFrequency: 'monthly',
          startDate: emp.dateOfJoining || new Date('2026-01-01'),
          endDate: null,
          status: 'active',
        },
      });
      created++;
    }

    // Voluntary top-up health for ~half [REQ-INS-02]
    if (i % 2 === 0) {
      const existingTop = await prisma.insurancePolicy.findFirst({
        where: { employeeId: emp.id, policyType: 'topup_health', providerName: 'HDFC Life' },
      });
      if (existingTop) {
        skipped++;
      } else {
        await prisma.insurancePolicy.create({
          data: {
            employeeId: emp.id,
            policyType: 'topup_health',
            providerName: 'HDFC Life',
            policyNumber: `TOP-HLTH-${String(i + 1).padStart(5, '0')}`,
            coverageAmount: 1_500_000,
            premiumAmount: 8_500,
            premiumCurrency: 'INR',
            paymentMode: 'payroll_deduction',
            deductionFrequency: 'monthly',
            startDate: daysAgo(60),
            endDate: null,
            dependentsJson: { spouse: true, children: 2 },
            status: 'active',
          },
        });
        created++;
      }
    }
  }

  // ─── Insurance Claims [REQ-INS-04] — AI-parsed bills ───
  const claimSpecs = [
    { empIdx: 0, amount: 35000, status: 'paid', diagnosis: 'Appendectomy — Apollo Hospital, Bengaluru', confidence: 0.94 },
    { empIdx: 1, amount: 12500, status: 'approved', diagnosis: 'Root canal — Clove Dental', confidence: 0.88 },
    { empIdx: 2, amount: 78000, status: 'under_review', diagnosis: 'Maternity — Cloudnine Hospital', confidence: 0.79 },
    { empIdx: 3, amount: 4500, status: 'submitted', diagnosis: 'Consultation + diagnostics — Fortis', confidence: 0.71 },
    { empIdx: 4, amount: 21000, status: 'rejected', diagnosis: 'Cosmetic procedure (not covered)', confidence: 0.65 },
    { empIdx: 5, amount: 92000, status: 'draft', diagnosis: 'Cardiac stent — Manipal Hospital', confidence: 0.83 },
  ];
  for (const cs of claimSpecs) {
    if (!employees[cs.empIdx]) continue;
    const policies = await prisma.insurancePolicy.findMany({
      where: { employeeId: employees[cs.empIdx].id, policyType: { in: ['group_health', 'topup_health'] } },
    });
    if (policies.length === 0) { skipped++; continue; }
    const policy = policies[0];
    const existingClaim = await prisma.insuranceClaim.findFirst({
      where: { policyId: policy.id, claimAmount: cs.amount, status: cs.status },
    });
    if (existingClaim) { skipped++; continue; }
    await prisma.insuranceClaim.create({
      data: {
        policyId: policy.id,
        employeeId: employees[cs.empIdx].id,
        claimAmount: cs.amount,
        billFileUrl: `https://cdn.example/claims/${policy.id}.pdf`,
        aiParsedJson: {
          amount: cs.amount,
          diagnosis: cs.diagnosis,
          policyNumber: policy.policyNumber,
          hospitalName: cs.diagnosis.split(' — ').pop() || 'Unknown Hospital',
          bill_date: daysAgo(Math.floor(Math.random() * 20) + 1).toISOString(),
        },
        aiConfidence: cs.confidence,
        status: cs.status,
        submittedAt: cs.status !== 'draft' ? daysAgo(10) : null,
        resolvedAt: cs.status === 'paid' || cs.status === 'rejected' ? daysAgo(3) : null,
        notes: cs.status === 'rejected' ? 'Procedure excluded under policy Schedule B.' : null,
      },
    });
    created++;
  }

  // ─── EWA Requests [REQ-FIN-01 / REQ-FIN-02 / REQ-FIN-03] ───
  const ewaSpecs = [
    { empIdx: 0, amount: 8000, provider: 'Wagestream', status: 'settled' },
    { empIdx: 1, amount: 12000, provider: 'Wagestream', status: 'transferred' },
    { empIdx: 2, amount: 5000, provider: 'EarnIn', status: 'approved' },
    { empIdx: 3, amount: 15000, provider: 'Wagestream', status: 'pending' },
    { empIdx: 4, amount: 4500, provider: 'EarnIn', status: 'settled' },
    { empIdx: 5, amount: 9000, provider: 'Wagestream', status: 'rejected' },
    { empIdx: 6, amount: 7000, provider: 'EarnIn', status: 'transferred' },
    { empIdx: 7, amount: 11000, provider: 'Wagestream', status: 'settled' },
  ];
  for (const es of ewaSpecs) {
    if (!employees[es.empIdx]) continue;
    const existing = await prisma.eWARequest.findFirst({
      where: { employeeId: employees[es.empIdx].id, requestedAmount: es.amount, providerName: es.provider },
    });
    if (existing) { skipped++; continue; }
    const fee = Math.round(es.amount * 0.025); // 2.5% fee
    await prisma.eWARequest.create({
      data: {
        employeeId: employees[es.empIdx].id,
        providerName: es.provider,
        requestedAmount: es.amount,
        earnedToDate: es.amount * 2 + 5000,
        feeAmount: fee,
        currency: 'INR',
        status: es.status,
        transferredAt: ['transferred', 'settled'].includes(es.status) ? daysAgo(5) : null,
        settledAt: es.status === 'settled' ? daysAgo(1) : null,
        payrollRunId: es.status === 'settled' ? 'payroll-run-2026-04' : null,
        externalRef: ['transferred', 'settled'].includes(es.status) ? `EWA-${Math.floor(Math.random() * 1e9)}` : null,
      },
    });
    created++;
  }

  // ─── Loan Marketplace Listings [REQ-FIN-04 / REQ-FIN-05] ───
  const loanSpecs = [
    { empIdx: 0, bank: 'HDFC Bank', amount: 500000, rate: 10.5, tenure: 36, status: 'disbursed', garnishment: false },
    { empIdx: 1, bank: 'ICICI Bank', amount: 750000, rate: 11.2, tenure: 60, status: 'approved', garnishment: false },
    { empIdx: 2, bank: 'Axis Bank', amount: 300000, rate: 12.0, tenure: 24, status: 'applied', garnishment: false },
    { empIdx: 3, bank: 'Bajaj Finserv', amount: 200000, rate: 14.5, tenure: 18, status: 'pre_approved', garnishment: false },
    { empIdx: 4, bank: 'Kotak Mahindra', amount: 1000000, rate: 9.8, tenure: 84, status: 'disbursed', garnishment: true },
    { empIdx: 5, bank: 'SBI', amount: 400000, rate: 10.9, tenure: 48, status: 'pre_approved', garnishment: false },
    { empIdx: 6, bank: 'Yes Bank', amount: 250000, rate: 13.4, tenure: 30, status: 'applied', garnishment: false },
  ];
  for (const ls of loanSpecs) {
    if (!employees[ls.empIdx]) continue;
    const existing = await prisma.loanMarketplaceListing.findFirst({
      where: { employeeId: employees[ls.empIdx].id, bankName: ls.bank, offerAmount: ls.amount },
    });
    if (existing) { skipped++; continue; }
    const emi = Math.round((ls.amount * (ls.rate / 100) * Math.pow(1 + ls.rate / 100, ls.tenure)) /
      (Math.pow(1 + ls.rate / 100, ls.tenure) - 1));
    await prisma.loanMarketplaceListing.create({
      data: {
        employeeId: employees[ls.empIdx].id,
        bankName: ls.bank,
        offerAmount: ls.amount,
        interestRate: ls.rate,
        tenureMonths: ls.tenure,
        emiAmount: emi,
        processingFee: Math.round(ls.amount * 0.01),
        currency: 'INR',
        consentGiven: ls.status !== 'pre_approved',
        consentAt: ls.status !== 'pre_approved' ? daysAgo(15) : null,
        deepLinkSentAt: ['applied', 'approved', 'disbursed'].includes(ls.status) ? daysAgo(12) : null,
        applicationStatus: ls.status,
        garnishmentActive: ls.garnishment,
      },
    });
    created++;
  }

  // ─── Gifts [REQ-GFT-01] — milestone-driven ───
  const giftEvents = [
    { empIdx: 0, trigger: 'work_anniversary', message: 'Happy 3rd work anniversary! Thank you for being part of the family.' },
    { empIdx: 1, trigger: 'birthday', message: 'Wishing you a fantastic birthday and an amazing year ahead!' },
    { empIdx: 2, trigger: 'project_completion', message: 'Congratulations on the successful go-live of the 3Boxes Platform!' },
    { empIdx: 3, trigger: 'high_performance', message: 'Recognition for your outstanding Q1 performance review!' },
    { empIdx: 4, trigger: 'referral', message: 'Thank you for referring a great candidate who joined us last week!' },
    { empIdx: 5, trigger: 'work_anniversary', message: 'Happy 2nd work anniversary!' },
    { empIdx: 6, trigger: 'birthday', message: 'Happy Birthday from the whole team!' },
    { empIdx: 7, trigger: 'project_completion', message: 'Mobile App v2.0 launched — congrats!' },
  ];
  const giftProducts = await prisma.marketplaceProduct.findMany({ where: { category: { in: ['gift_card', 'voucher'] } }, take: 5 });
  for (const ge of giftEvents) {
    if (!employees[ge.empIdx]) continue;
    const existing = await prisma.gift.findFirst({
      where: { recipientId: employees[ge.empIdx].id, triggerEvent: ge.trigger },
    });
    if (existing) { skipped++; continue; }
    const product = giftProducts[Math.floor(Math.random() * giftProducts.length)];
    await prisma.gift.create({
      data: {
        recipientId: employees[ge.empIdx].id,
        senderId: employees[(ge.empIdx + 1) % employees.length]?.id || null,
        triggerEvent: ge.trigger,
        productId: product?.id || null,
        voucherCode: `VCHR-${Math.floor(Math.random() * 1e9)}`,
        message: ge.message,
        value: product?.corporatePrice || 500,
        currency: 'INR',
        status: 'redeemed',
        createdAt: daysAgo(Math.floor(Math.random() * 30) + 1),
      },
    });
    created++;
  }

  // ─── Reward Points Ledger [REQ-GFT-03] — P2P kudos + performance earns ───
  for (let i = 0; i < employees.length; i++) {
    const emp = employees[i];
    // Earn — milestone
    const existingMilestone = await prisma.rewardPointsLedger.findFirst({
      where: { employeeId: emp.id, source: 'milestone' },
    });
    if (existingMilestone) {
      skipped++;
    } else {
      await prisma.rewardPointsLedger.create({
        data: {
          employeeId: emp.id,
          type: 'earn',
          points: 100,
          balanceAfter: 100,
          source: 'milestone',
          referenceId: `ms-${emp.id}`,
          createdAt: daysAgo(20),
        },
      });
      created++;
    }

    // Earn — performance (only for some)
    if (i % 3 === 0) {
      const existingPerf = await prisma.rewardPointsLedger.findFirst({
        where: { employeeId: emp.id, source: 'performance' },
      });
      if (existingPerf) { skipped++; continue; }
      await prisma.rewardPointsLedger.create({
        data: {
          employeeId: emp.id,
          type: 'earn',
          points: 250,
          balanceAfter: 350,
          source: 'performance',
          referenceId: `perf-${emp.id}`,
          createdAt: daysAgo(15),
        },
      });
      created++;
    }

    // Earn — P2P kudos from a different employee
    const senderIdx = (i + 1) % employees.length;
    const existingKudos = await prisma.rewardPointsLedger.findFirst({
      where: { employeeId: emp.id, source: 'p2p_kudos' },
    });
    if (existingKudos) {
      skipped++;
    } else {
      await prisma.rewardPointsLedger.create({
        data: {
          employeeId: emp.id,
          type: 'earn',
          points: 50,
          balanceAfter: 400,
          source: 'p2p_kudos',
          referenceId: `kudos-${senderIdx}-${emp.id}`,
          createdAt: daysAgo(10),
        },
      });
      created++;
    }

    // Redeem (some employees)
    if (i % 4 === 0) {
      const existingRedeem = await prisma.rewardPointsLedger.findFirst({
        where: { employeeId: emp.id, type: 'redeem' },
      });
      if (existingRedeem) { skipped++; continue; }
      await prisma.rewardPointsLedger.create({
        data: {
          employeeId: emp.id,
          type: 'redeem',
          points: -200,
          balanceAfter: 200,
          source: 'redemption',
          referenceId: `redeem-${emp.id}`,
          createdAt: daysAgo(3),
        },
      });
      created++;
    }
  }

  // ─── Financial Stress Flag [REQ-AI-MKT-03] ───
  const stressSpecs = [
    { empIdx: 4, level: 'high', score: 0.82, factors: { ewaUsage: 4, paydayLoans: 1, attendanceDrop: 0.18 }, action: 'Schedule confidential financial wellness counseling. Consider targeted EAP referral.' },
    { empIdx: 7, level: 'high', score: 0.76, factors: { ewaUsage: 6, paydayLoans: 0, attendanceDrop: 0.12 }, action: 'Proactive EWA limit review + financial literacy session.' },
    { empIdx: 1, level: 'medium', score: 0.55, factors: { ewaUsage: 2, paydayLoans: 0, attendanceDrop: 0.05 }, action: 'Send budgeting toolkit; monitor for trend continuation.' },
    { empIdx: 3, level: 'medium', score: 0.48, factors: { ewaUsage: 3, paydayLoans: 0, attendanceDrop: 0.08 }, action: 'Optional 1:1 with HR benefits counselor.' },
    { empIdx: 0, level: 'low', score: 0.18, factors: { ewaUsage: 1, paydayLoans: 0, attendanceDrop: 0.02 }, action: 'No action needed.' },
  ];
  for (const ss of stressSpecs) {
    if (!employees[ss.empIdx]) continue;
    const existing = await prisma.financialStressFlag.findFirst({ where: { employeeId: employees[ss.empIdx].id } });
    if (existing) { skipped++; continue; }
    await prisma.financialStressFlag.create({
      data: {
        employeeId: employees[ss.empIdx].id,
        riskScore: ss.score,
        riskLevel: ss.level,
        factorsJson: ss.factors,
        recommendedAction: ss.action,
        notifiedHR: ss.level === 'high',
        anonymized: true,
        evaluatedAt: daysAgo(2),
      },
    });
    created++;
  }

  return {
    created,
    skipped,
    note: '60 insurance policies (health+life+topup) + 6 claims + 8 EWA + 7 loan listings + 8 gifts + 50+ reward ledger entries + 5 financial stress flags',
  };
}

// ────────────────────────────────────────────────────────────────────────────
// COLLABORATION HUB — chat rooms, files, call recordings
// Seeds 4 chat rooms with messages, 5 files in personal/project drives,
// and 2 call recordings so the Collaboration Hub landing page + sub-pages
// always have something to show.
// ────────────────────────────────────────────────────────────────────────────
export async function seedCollaboration(companyId: string, employees: SeedEmployee[]): Promise<SeedResult> {
  let created = 0;
  let skipped = 0;

  if (employees.length === 0) {
    return { created, skipped, note: 'no employees to assign collaboration data to' };
  }

  // Pick the first 5 employees as "active collaborators"
  const collab = employees.slice(0, 5);
  const ownerId = collab[0].id;

  // ─── 1. Chat Rooms (ChatRoom + ChatRoomMember + ChatMessage) ───
  const roomSpecs = [
    { name: 'General Announcements', type: 'announcement', isAnnouncement: true, isE2EE: false, desc: 'Company-wide announcements' },
    { name: 'Engineering Standup', type: 'group', isAnnouncement: false, isE2EE: false, desc: 'Daily engineering standup coordination' },
    { name: 'HR Confidential (E2EE)', type: 'direct', isAnnouncement: false, isE2EE: true, desc: 'End-to-end encrypted 1:1 with HR' },
    { name: 'Project Phoenix Sync', type: 'project', isAnnouncement: false, isE2EE: false, desc: 'Cross-functional project sync room' },
  ];

  for (const spec of roomSpecs) {
    const existing = await (prisma as any).chatRoom.findFirst({ where: { name: spec.name, companyId } }).catch(() => null);
    if (existing) { skipped++; continue; }

    let room: any = null;
    try {
      room = await (prisma as any).chatRoom.create({
        data: {
          name: spec.name,
          companyId,
          roomType: spec.type,
          isE2EE: spec.isE2EE,
          isAnnouncement: spec.isAnnouncement,
          description: spec.desc,
          createdBy: ownerId,
          isActive: true,
          lastMessageAt: daysAgo(1),
          members: {
            create: collab.map((e, idx) => ({
              userId: e.id,
              role: idx === 0 ? 'admin' : 'member',
              lastReadAt: idx === 0 ? new Date() : daysAgo(2),
            })),
          },
        },
      });
      created++;
    } catch {
      skipped++;
    }

    if (room) {
      // Seed a few messages per room
      const msgs = [
        { senderId: collab[1 % collab.length].id, body: `Welcome to ${spec.name}!` },
        { senderId: collab[2 % collab.length].id, body: 'Thanks for setting this up. Quick question — when is our next sync?' },
        { senderId: collab[0].id, body: spec.isAnnouncement ? 'Please keep this channel for announcements only.' : 'Tomorrow at 10 AM. Will send a calendar invite.' },
      ];
      for (const m of msgs) {
        try {
          await (prisma as any).chatMessage.create({
            data: {
              roomId: room.id,
              senderId: m.senderId,
              body: m.body,
              dlpStatus: 'clean',
              isDeleted: false,
            },
          });
          created++;
        } catch { skipped++; }
      }
    }
  }

  // ─── 2. Files (FileNode — personal/project/company drives) ───
  const fileSpecs = [
    { name: 'Q1-2026-Board-Meeting-Minutes.docx', drive: 'company', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', size: 245_680, watermark: true },
    { name: 'Employee-Handbook-v3.2.pdf', drive: 'company', mime: 'application/pdf', size: 1_245_680, watermark: false },
    { name: 'Project-Phoenix-SOW-Draft.docx', drive: 'project', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', size: 187_452, watermark: true },
    { name: 'Personal-Goals-2026.xlsx', drive: 'personal', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', size: 45_120, watermark: false },
    { name: 'Payroll-Process-Runbook.pdf', drive: 'company', mime: 'application/pdf', size: 567_890, watermark: true },
  ];

  for (const f of fileSpecs) {
    // Check by name + drive scope (companyId for company drive, ownerEmployeeId for personal)
    const where: any = { name: f.name, driveType: f.drive };
    if (f.drive === 'company') where.companyId = companyId;
    if (f.drive === 'personal') where.ownerEmployeeId = ownerId;
    const existing = await (prisma as any).fileNode.findFirst({ where }).catch(() => null);
    if (existing) { skipped++; continue; }

    try {
      await (prisma as any).fileNode.create({
        data: {
          name: f.name,
          driveType: f.drive,
          companyId: f.drive === 'company' ? companyId : null,
          ownerEmployeeId: f.drive === 'personal' ? ownerId : null,
          // projectId stays null for now (project drive file but no project context)
          projectId: null,
          parentId: null,
          nodeType: 'file',
          mimeType: f.mime,
          sizeBytes: f.size,
          storagePath: `uploads/collab/${f.drive}/${encodeURIComponent(f.name)}`,
          currentVersion: 1,
          dlpScanStatus: 'clean',
          watermarkEnabled: f.watermark,
          uploadedById: ownerId,
          isActive: true,
        },
      });
      created++;
    } catch { skipped++; }
  }

  // ─── 3. Call Logs (CallLog + CallParticipant) ───
  const callSpecs = [
    { title: 'Engineering Standup — Jan 12', participants: [collab[0].id, collab[1].id, collab[2].id], duration: 1820, isE2EE: false, video: true },
    { title: '1:1 with HR (E2EE)', participants: [collab[0].id, collab[3].id], duration: 940, isE2EE: true, video: false },
  ];

  for (const c of callSpecs) {
    // CallLog has no title field — use startedAt + initiatorId as uniqueness proxy
    const existing = await (prisma as any).callLog.findFirst({
      where: { initiatorId: ownerId, startedAt: { gte: daysAgo(4), lte: daysAgo(2) } },
    }).catch(() => null);
    if (existing) { skipped++; continue; }

    try {
      const call = await (prisma as any).callLog.create({
        data: {
          callType: c.video ? 'video' : 'audio',
          provider: 'native_webrtc',
          initiatorId: ownerId,
          startedAt: daysAgo(3),
          endedAt: daysAgo(3),
          durationSec: c.duration,
          status: 'completed',
          consentForRecording: !c.isE2EE,
          transcriptUrl: `s3://calls/${encodeURIComponent(c.title)}.txt`,
          transcriptStatus: 'ready',
          summaryText: `AI Summary — ${c.title}: Discussion covered project status, blockers, and next steps. Action items captured.`,
          isE2EE: c.isE2EE,
          participants: {
            create: c.participants.map((uid) => ({
              userId: uid,
              joinedAt: daysAgo(3),
              leftAt: daysAgo(3),
              connectionQuality: 'good',
            })),
          },
        },
      });
      created++;
    } catch { skipped++; }
  }

  return {
    created,
    skipped,
    note: '4 chat rooms + ~12 messages + 5 files + 2 call recordings (collaboration hub demo data)',
  };
}
