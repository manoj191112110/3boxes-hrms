/**
 * Payroll Module Seed API Endpoint
 * Call GET /api/seed/payroll to seed payroll sample data
 *
 * ⚠️ LIVE MODE GUARD: Blocked on the live production platform.
 */
import { NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { isLiveMode } from '@/lib/site-mode';

export async function GET(request: Request) {
  // ─── LIVE MODE GUARD ───
  if (isLiveMode(request)) {
    return NextResponse.json({ error: 'Seeding is disabled on the live platform.', code: 'LIVE_MODE_BLOCKED' }, { status: 403 });
  }

  try {
    console.log('[Payroll Seed] Starting payroll module seeding...');

    // ─── Fetch existing data ───────────────────────
    const companies = await db.company.findMany({ include: { branches: true } });
    const employees = await db.employee.findMany();
    const departments = await db.department.findMany();

    if (companies.length === 0) {
      return NextResponse.json({ error: 'No companies found. Run the base seed first via /api/seed' }, { status: 400 });
    }

    const tcg = companies.find(c => c.code === 'TCG') || companies.find(c => c.code === 'NTU') || companies[0];
    const mpi = companies.find(c => c.code === 'MPI') || companies.find(c => c.code === 'NTI') || companies[1];
    const hfs = companies.find(c => c.code === 'HFS') || companies.find(c => c.code === 'NSU') || companies[2];

    const companyEmployees = employees.filter(e => e.companyId === tcg.id);
    console.log(`[Payroll Seed] Found ${companyEmployees.length} employees in primary company`);

    const results: string[] = [];

    // ═══ PAYROLL COMPONENTS — India ═══
    const indiaComponents = [
      { code: 'BASIC', name: 'Basic Salary', componentType: 'EARNING', componentCategory: 'NORMAL', calculationType: 'PERCENTAGE', defaultValue: 40, percentageBase: 'CTC', isTaxable: true, taxTreatment: 'FULLY_TAXABLE', affectsGross: true, affectsNet: true, affectsCTC: true, countryCode: 'IND' },
      { code: 'HRA', name: 'House Rent Allowance', componentType: 'EARNING', componentCategory: 'NORMAL', calculationType: 'PERCENTAGE', defaultValue: 20, percentageBase: 'CTC', isTaxable: true, taxTreatment: 'PARTIALLY_TAXABLE', exemptionSection: '80GG/10(13A)', maxExemptionAmt: 240000, affectsGross: true, affectsNet: true, affectsCTC: true, countryCode: 'IND' },
      { code: 'DA', name: 'Dearness Allowance', componentType: 'EARNING', componentCategory: 'NORMAL', calculationType: 'PERCENTAGE', defaultValue: 10, percentageBase: 'BASIC', isTaxable: true, taxTreatment: 'FULLY_TAXABLE', affectsGross: true, affectsNet: true, affectsCTC: true, countryCode: 'IND' },
      { code: 'CONV', name: 'Conveyance Allowance', componentType: 'EARNING', componentCategory: 'NORMAL', calculationType: 'FLAT_AMOUNT', defaultValue: 3200, isTaxable: true, taxTreatment: 'FULLY_TAXABLE', affectsGross: true, affectsNet: true, affectsCTC: true, countryCode: 'IND' },
      { code: 'MED', name: 'Medical Allowance', componentType: 'EARNING', componentCategory: 'NORMAL', calculationType: 'FLAT_AMOUNT', defaultValue: 2500, isTaxable: true, taxTreatment: 'PARTIALLY_TAXABLE', exemptionSection: '80D', maxExemptionAmt: 25000, affectsGross: true, affectsNet: true, affectsCTC: true, countryCode: 'IND' },
      { code: 'SA', name: 'Special Allowance', componentType: 'EARNING', componentCategory: 'NORMAL', calculationType: 'FLAT_AMOUNT', defaultValue: 0, isTaxable: true, taxTreatment: 'FULLY_TAXABLE', affectsGross: true, affectsNet: true, affectsCTC: true, countryCode: 'IND' },
      { code: 'BONUS', name: 'Performance Bonus', componentType: 'EARNING', componentCategory: 'NORMAL', calculationType: 'PERCENTAGE', defaultValue: 10, percentageBase: 'BASIC', isTaxable: true, taxTreatment: 'FULLY_TAXABLE', affectsGross: true, affectsNet: true, affectsCTC: true, paymentFrequency: 'ANNUAL', countryCode: 'IND' },
      { code: 'LTA', name: 'Leave Travel Allowance', componentType: 'EARNING', componentCategory: 'NORMAL', calculationType: 'FLAT_AMOUNT', defaultValue: 15000, isTaxable: true, taxTreatment: 'PARTIALLY_TAXABLE', exemptionSection: '10(5)', maxExemptionAmt: 15000, affectsGross: true, affectsNet: true, affectsCTC: true, paymentFrequency: 'ANNUAL', countryCode: 'IND' },
      { code: 'EPF_EE', name: 'EPF - Employee Contribution', componentType: 'EMPLOYEE_CONTRIB', componentCategory: 'STATUTORY', calculationType: 'PERCENTAGE', defaultValue: 12, percentageBase: 'BASIC', isTaxable: false, taxTreatment: 'EXEMPT', affectsGross: false, affectsNet: true, affectsCTC: false, countryCode: 'IND' },
      { code: 'ESI_EE', name: 'ESI - Employee Contribution', componentType: 'EMPLOYEE_CONTRIB', componentCategory: 'STATUTORY', calculationType: 'PERCENTAGE', defaultValue: 0.75, percentageBase: 'GROSS', isTaxable: false, taxTreatment: 'EXEMPT', affectsGross: false, affectsNet: true, affectsCTC: false, countryCode: 'IND' },
      { code: 'PT', name: 'Professional Tax', componentType: 'DEDUCTION', componentCategory: 'STATUTORY', calculationType: 'SLAB_BASED', isTaxable: false, taxTreatment: 'EXEMPT', affectsGross: false, affectsNet: true, affectsCTC: false, countryCode: 'IND' },
      { code: 'TDS', name: 'Tax Deducted at Source', componentType: 'DEDUCTION', componentCategory: 'STATUTORY', calculationType: 'SLAB_BASED', isTaxable: false, taxTreatment: 'EXEMPT', affectsGross: false, affectsNet: true, affectsCTC: false, countryCode: 'IND' },
      { code: 'LWF_EE', name: 'Labour Welfare Fund - Employee', componentType: 'EMPLOYEE_CONTRIB', componentCategory: 'STATUTORY', calculationType: 'FLAT_AMOUNT', defaultValue: 25, isTaxable: false, taxTreatment: 'EXEMPT', affectsGross: false, affectsNet: true, affectsCTC: false, paymentFrequency: 'ANNUAL', countryCode: 'IND' },
      { code: 'EPF_ER', name: 'EPF - Employer Contribution', componentType: 'EMPLOYER_CONTRIB', componentCategory: 'STATUTORY', calculationType: 'PERCENTAGE', defaultValue: 12, percentageBase: 'BASIC', isTaxable: false, taxTreatment: 'EXEMPT', affectsGross: false, affectsNet: false, affectsCTC: true, countryCode: 'IND' },
      { code: 'ESI_ER', name: 'ESI - Employer Contribution', componentType: 'EMPLOYER_CONTRIB', componentCategory: 'STATUTORY', calculationType: 'PERCENTAGE', defaultValue: 3.25, percentageBase: 'GROSS', isTaxable: false, taxTreatment: 'EXEMPT', affectsGross: false, affectsNet: false, affectsCTC: true, countryCode: 'IND' },
    ];

    const indiaComponentMap = new Map<string, string>();
    let indiaCompCreated = 0;
    for (const comp of indiaComponents) {
      const existing = await db.payrollComponent.findUnique({
        where: { code_countryCode: { code: comp.code, countryCode: comp.countryCode } }
      });
      if (existing) { indiaComponentMap.set(comp.code, existing.id); continue; }
      const created = await db.payrollComponent.create({ data: comp as any });
      indiaComponentMap.set(comp.code, created.id);
      indiaCompCreated++;
    }
    results.push(`${indiaCompCreated} India components created`);

    // ═══ PAYROLL COMPONENTS — US ═══
    const usComponents = [
      { code: 'BASE_US', name: 'Base Salary', componentType: 'EARNING', componentCategory: 'NORMAL', calculationType: 'PERCENTAGE', defaultValue: 100, percentageBase: 'CTC', isTaxable: true, taxTreatment: 'FULLY_TAXABLE', affectsGross: true, affectsNet: true, affectsCTC: true, countryCode: 'USA' },
      { code: 'BONUS_US', name: 'Annual Bonus', componentType: 'EARNING', componentCategory: 'NORMAL', calculationType: 'PERCENTAGE', defaultValue: 15, percentageBase: 'BASE_US', isTaxable: true, taxTreatment: 'FULLY_TAXABLE', affectsGross: true, affectsNet: true, affectsCTC: true, paymentFrequency: 'ANNUAL', countryCode: 'USA' },
      { code: 'HSA_US', name: 'Health Savings Account', componentType: 'EARNING', componentCategory: 'NORMAL', calculationType: 'FLAT_AMOUNT', defaultValue: 4150, isTaxable: true, taxTreatment: 'PARTIALLY_TAXABLE', exemptionSection: '401k/IRA', maxExemptionAmt: 4150, affectsGross: true, affectsNet: true, affectsCTC: true, paymentFrequency: 'ANNUAL', countryCode: 'USA' },
      { code: 'FIT', name: 'Federal Income Tax', componentType: 'DEDUCTION', componentCategory: 'STATUTORY', calculationType: 'SLAB_BASED', isTaxable: false, taxTreatment: 'EXEMPT', affectsGross: false, affectsNet: true, affectsCTC: false, countryCode: 'USA' },
      { code: 'SIT', name: 'State Income Tax', componentType: 'DEDUCTION', componentCategory: 'STATUTORY', calculationType: 'PERCENTAGE', defaultValue: 9.3, percentageBase: 'GROSS', isTaxable: false, taxTreatment: 'EXEMPT', affectsGross: false, affectsNet: true, affectsCTC: false, countryCode: 'USA' },
      { code: 'SS_EE', name: 'Social Security - Employee', componentType: 'EMPLOYEE_CONTRIB', componentCategory: 'STATUTORY', calculationType: 'PERCENTAGE', defaultValue: 6.2, percentageBase: 'GROSS', isTaxable: false, taxTreatment: 'EXEMPT', affectsGross: false, affectsNet: true, affectsCTC: false, countryCode: 'USA' },
      { code: 'MED_EE', name: 'Medicare - Employee', componentType: 'EMPLOYEE_CONTRIB', componentCategory: 'STATUTORY', calculationType: 'PERCENTAGE', defaultValue: 1.45, percentageBase: 'GROSS', isTaxable: false, taxTreatment: 'EXEMPT', affectsGross: false, affectsNet: true, affectsCTC: false, countryCode: 'USA' },
      { code: '401K_EE', name: '401(k) - Employee Contribution', componentType: 'DEDUCTION', componentCategory: 'NORMAL', calculationType: 'PERCENTAGE', defaultValue: 6, percentageBase: 'BASE_US', isTaxable: true, taxTreatment: 'DEFERRED', exemptionSection: '401k', maxExemptionAmt: 23000, affectsGross: false, affectsNet: true, affectsCTC: false, countryCode: 'USA' },
      { code: 'SS_ER', name: 'Social Security - Employer', componentType: 'EMPLOYER_CONTRIB', componentCategory: 'STATUTORY', calculationType: 'PERCENTAGE', defaultValue: 6.2, percentageBase: 'GROSS', isTaxable: false, taxTreatment: 'EXEMPT', affectsGross: false, affectsNet: false, affectsCTC: true, countryCode: 'USA' },
      { code: 'MED_ER', name: 'Medicare - Employer', componentType: 'EMPLOYER_CONTRIB', componentCategory: 'STATUTORY', calculationType: 'PERCENTAGE', defaultValue: 1.45, percentageBase: 'GROSS', isTaxable: false, taxTreatment: 'EXEMPT', affectsGross: false, affectsNet: false, affectsCTC: true, countryCode: 'USA' },
      { code: 'HI_ER', name: 'Health Insurance - Employer', componentType: 'EMPLOYER_CONTRIB', componentCategory: 'NORMAL', calculationType: 'FLAT_AMOUNT', defaultValue: 850, isTaxable: false, taxTreatment: 'EXEMPT', affectsGross: false, affectsNet: false, affectsCTC: true, countryCode: 'USA' },
    ];

    const usComponentMap = new Map<string, string>();
    let usCompCreated = 0;
    for (const comp of usComponents) {
      const existing = await db.payrollComponent.findUnique({
        where: { code_countryCode: { code: comp.code, countryCode: comp.countryCode } }
      });
      if (existing) { usComponentMap.set(comp.code, existing.id); continue; }
      const created = await db.payrollComponent.create({ data: comp as any });
      usComponentMap.set(comp.code, created.id);
      usCompCreated++;
    }
    results.push(`${usCompCreated} US components created`);

    // ═══ STATUTORY COMPONENTS ═══
    const statutoryData = [
      { componentId: indiaComponentMap.get('EPF_EE')!, componentCode: 'EPF_EE', componentName: 'Employees Provident Fund', countryCode: 'IND', authorityName: 'EPFO', authorityCode: 'EPFO', partyType: 'BOTH', calculationBasis: 'BASIC_PAY', ratePercentage: 12, wageCeiling: 15000, maxContributionAmt: 1800, remittanceFrequency: 'MONTHLY', remittanceDueDay: 15, filingFrequency: 'MONTHLY', filingFormat: 'ECR', penaltyRatePct: 1, isChallanRequired: true, challanFormat: 'EPF_CHALLAN', effectiveFrom: new Date('2024-04-01') },
      { componentId: indiaComponentMap.get('ESI_EE')!, componentCode: 'ESI', componentName: 'Employees State Insurance', countryCode: 'IND', authorityName: 'ESIC', authorityCode: 'ESIC', partyType: 'BOTH', calculationBasis: 'GROSS_PAY', ratePercentage: 4.0, wageCeiling: 21000, remittanceFrequency: 'MONTHLY', remittanceDueDay: 15, filingFrequency: 'HALF_YEARLY', filingFormat: 'FPS', penaltyRatePct: 1.5, isChallanRequired: true, challanFormat: 'ESI_CHALLAN', effectiveFrom: new Date('2024-04-01') },
      { componentId: indiaComponentMap.get('PT')!, componentCode: 'PT', componentName: 'Professional Tax', countryCode: 'IND', authorityName: 'State Commercial Tax Department', authorityCode: 'SCTD', partyType: 'EMPLOYEE', calculationBasis: 'SLAB_BASED', remittanceFrequency: 'MONTHLY', remittanceDueDay: 20, filingFrequency: 'ANNUAL', filingFormat: 'PT_RETURN', isChallanRequired: true, challanFormat: 'PT_CHALLAN', effectiveFrom: new Date('2024-04-01') },
      { componentId: indiaComponentMap.get('TDS')!, componentCode: 'TDS', componentName: 'Tax Deducted at Source', countryCode: 'IND', authorityName: 'Income Tax Department', authorityCode: 'ITD', partyType: 'EMPLOYEE', calculationBasis: 'SLAB_BASED', remittanceFrequency: 'MONTHLY', remittanceDueDay: 7, filingFrequency: 'QUARTERLY', filingFormat: 'FORM_24Q', penaltyRatePct: 1.5, isChallanRequired: true, challanFormat: 'ITNS_281', effectiveFrom: new Date('2024-04-01') },
      { componentId: usComponentMap.get('SS_EE')!, componentCode: 'SS', componentName: 'Social Security (FICA)', countryCode: 'USA', authorityName: 'IRS', authorityCode: 'IRS', partyType: 'BOTH', calculationBasis: 'GROSS_PAY', ratePercentage: 6.2, wageCeiling: 168600, remittanceFrequency: 'MONTHLY', remittanceDueDay: 15, filingFrequency: 'QUARTERLY', filingFormat: 'FORM_941', penaltyRatePct: 2, isChallanRequired: true, challanFormat: 'EFTPS', effectiveFrom: new Date('2025-01-01') },
      { componentId: usComponentMap.get('MED_EE')!, componentCode: 'MEDICARE', componentName: 'Medicare (FICA)', countryCode: 'USA', authorityName: 'IRS', authorityCode: 'IRS', partyType: 'BOTH', calculationBasis: 'GROSS_PAY', ratePercentage: 1.45, remittanceFrequency: 'MONTHLY', remittanceDueDay: 15, filingFrequency: 'QUARTERLY', filingFormat: 'FORM_941', penaltyRatePct: 2, isChallanRequired: true, challanFormat: 'EFTPS', effectiveFrom: new Date('2025-01-01') },
    ].filter(s => s.componentId);

    let statutoryCreated = 0;
    for (const sc of statutoryData) {
      const existing = await db.statutoryComponent.findFirst({ where: { componentCode: sc.componentCode, countryCode: sc.countryCode } });
      if (existing) continue;
      await db.statutoryComponent.create({ data: sc as any });
      statutoryCreated++;
    }
    results.push(`${statutoryCreated} statutory components created`);

    // ═══ SALARY STRUCTURES ═══
    const structures = [
      { name: 'India Standard Structure', companyId: mpi.id, country: 'IN', currency: 'INR', description: 'Standard salary structure for India employees with Basic, HRA, DA, and statutory deductions', status: 'active' },
      { name: 'US Standard Structure', companyId: tcg.id, country: 'US', currency: 'USD', description: 'Standard salary structure for US employees with Base, 401k, and FICA deductions', status: 'active' },
      { name: 'UK Standard Structure', companyId: hfs?.id || tcg.id, country: 'GB', currency: 'GBP', description: 'Standard salary structure for UK employees with PAYE and NI contributions', status: 'active' },
    ];

    for (const ss of structures) {
      const existing = await db.salaryStructure.findFirst({ where: { name: ss.name, companyId: ss.companyId } });
      if (existing) continue;
      const created = await db.salaryStructure.create({ data: ss });
      // Add basic salary component for each structure
      const existingComp = await db.salaryComponent.findFirst({ where: { salaryStructureId: created.id, name: ss.country === 'US' ? 'Base Salary' : 'Basic Salary' } });
      if (!existingComp) {
        await db.salaryComponent.create({
          data: {
            salaryStructureId: created.id,
            name: ss.country === 'US' ? 'Base Salary' : 'Basic Salary',
            type: 'earning',
            category: 'basic',
            calculationType: 'percentage',
            value: ss.country === 'US' ? 100 : 40,
            percentageOf: ss.country === 'US' ? 'CTC' : 'CTC',
            isTaxable: true,
            isStatutory: false,
            sortOrder: 1,
            status: 'active',
          }
        });
      }
    }
    results.push(`${structures.length} salary structures created`);

    // ═══ CTC TEMPLATES ═══
    let ctcCount = 0;
    const existingCTC = await db.cTCTemplate.findFirst({ where: { name: 'US Standard CTC Template' } });
    if (!existingCTC) {
      await db.cTCTemplate.create({
        data: {
          name: 'US Standard CTC Template',
          countryCode: 'USA',
          currencyCode: 'USD',
          ctcType: 'ANNUAL',
          status: 'ACTIVE',
          isDefault: true,
          basePayPct: 100,
          effectiveFrom: new Date('2025-01-01'),
          companyId: tcg.id,
          componentMappings: {
            create: [
              { componentName: 'Base Salary', componentCategory: 'EARNING', allocationMethod: 'PERCENTAGE_OF_CTC', allocationValue: 100, calculationSequence: 1, isStatutory: false, isTaxable: true, frequency: 'MONTHLY', prorationRule: 'WORKING_DAYS' },
              { componentName: 'Annual Bonus', componentCategory: 'EARNING', allocationMethod: 'PERCENTAGE_OF_COMPONENT', allocationValue: 15, calculationSequence: 2, isStatutory: false, isTaxable: true, frequency: 'ANNUAL' },
              { componentName: 'Federal Income Tax', componentCategory: 'DEDUCTION', allocationMethod: 'PERCENTAGE_OF_CTC', allocationValue: 22, calculationSequence: 3, isStatutory: true, isTaxable: false, frequency: 'MONTHLY' },
              { componentName: 'State Income Tax', componentCategory: 'DEDUCTION', allocationMethod: 'PERCENTAGE_OF_CTC', allocationValue: 9.3, calculationSequence: 4, isStatutory: true, isTaxable: false, frequency: 'MONTHLY' },
              { componentName: 'Social Security', componentCategory: 'DEDUCTION', allocationMethod: 'PERCENTAGE_OF_CTC', allocationValue: 6.2, calculationSequence: 5, isStatutory: true, isTaxable: false, frequency: 'MONTHLY' },
              { componentName: 'Medicare', componentCategory: 'DEDUCTION', allocationMethod: 'PERCENTAGE_OF_CTC', allocationValue: 1.45, calculationSequence: 6, isStatutory: true, isTaxable: false, frequency: 'MONTHLY' },
              { componentName: '401(k)', componentCategory: 'DEDUCTION', allocationMethod: 'PERCENTAGE_OF_COMPONENT', allocationValue: 6, calculationSequence: 7, isStatutory: false, isTaxable: true, taxExemptionLimit: 23000, frequency: 'MONTHLY' },
            ]
          }
        }
      });
      ctcCount++;
    }

    const existingIndiaCTC = await db.cTCTemplate.findFirst({ where: { name: 'India Standard CTC Template' } });
    if (!existingIndiaCTC) {
      await db.cTCTemplate.create({
        data: {
          name: 'India Standard CTC Template',
          countryCode: 'IND',
          currencyCode: 'INR',
          ctcType: 'ANNUAL',
          status: 'ACTIVE',
          isDefault: true,
          basePayPct: 40,
          effectiveFrom: new Date('2025-04-01'),
          companyId: mpi.id,
          componentMappings: {
            create: [
              { componentName: 'Basic Salary', componentCategory: 'EARNING', allocationMethod: 'PERCENTAGE_OF_CTC', allocationValue: 40, calculationSequence: 1, isStatutory: false, isTaxable: true, frequency: 'MONTHLY', prorationRule: 'CALENDAR_DAYS' },
              { componentName: 'House Rent Allowance', componentCategory: 'EARNING', allocationMethod: 'PERCENTAGE_OF_CTC', allocationValue: 20, calculationSequence: 2, isStatutory: false, isTaxable: true, frequency: 'MONTHLY', prorationRule: 'CALENDAR_DAYS' },
              { componentName: 'Dearness Allowance', componentCategory: 'EARNING', allocationMethod: 'PERCENTAGE_OF_COMPONENT', allocationValue: 10, calculationSequence: 3, isStatutory: false, isTaxable: true, frequency: 'MONTHLY' },
              { componentName: 'Conveyance Allowance', componentCategory: 'EARNING', allocationMethod: 'FIXED_AMOUNT', allocationValue: 3200, calculationSequence: 4, isStatutory: false, isTaxable: true, frequency: 'MONTHLY' },
              { componentName: 'Medical Allowance', componentCategory: 'EARNING', allocationMethod: 'FIXED_AMOUNT', allocationValue: 2500, calculationSequence: 5, isStatutory: false, isTaxable: true, frequency: 'MONTHLY' },
              { componentName: 'EPF - Employee', componentCategory: 'DEDUCTION', allocationMethod: 'PERCENTAGE_OF_COMPONENT', allocationValue: 12, calculationSequence: 6, isStatutory: true, isTaxable: false, frequency: 'MONTHLY' },
              { componentName: 'EPF - Employer', componentCategory: 'EMPLOYER_CONTRIBUTION', allocationMethod: 'PERCENTAGE_OF_COMPONENT', allocationValue: 12, calculationSequence: 7, isStatutory: true, isTaxable: false, frequency: 'MONTHLY' },
              { componentName: 'Professional Tax', componentCategory: 'DEDUCTION', allocationMethod: 'FIXED_AMOUNT', allocationValue: 200, calculationSequence: 8, isStatutory: true, isTaxable: false, frequency: 'MONTHLY' },
            ]
          }
        }
      });
      ctcCount++;
    }
    results.push(`${ctcCount} CTC templates created`);

    // ═══ TAX SLAB TABLES ═══
    let taxSlabCount = 0;
    const existingIndiaTax = await db.taxSlabTable.findFirst({ where: { name: 'India New Tax Regime FY 2025-26' } });
    if (!existingIndiaTax) {
      await db.taxSlabTable.create({
        data: {
          name: 'India New Tax Regime FY 2025-26',
          countryCode: 'IND',
          taxYear: '2025-26',
          filingStatus: 'SINGLE',
          regimeType: 'NEW',
          effectiveFrom: new Date('2025-04-01'),
          companyId: mpi.id,
          rateLines: {
            create: [
              { sequence: 1, incomeFrom: 0, incomeTo: 400000, ratePercentage: 0, fixedAmount: 0 },
              { sequence: 2, incomeFrom: 400000, incomeTo: 800000, ratePercentage: 5, fixedAmount: 0 },
              { sequence: 3, incomeFrom: 800000, incomeTo: 1200000, ratePercentage: 10, fixedAmount: 20000 },
              { sequence: 4, incomeFrom: 1200000, incomeTo: 1600000, ratePercentage: 15, fixedAmount: 60000 },
              { sequence: 5, incomeFrom: 1600000, incomeTo: 2000000, ratePercentage: 20, fixedAmount: 120000 },
              { sequence: 6, incomeFrom: 2000000, incomeTo: 2400000, ratePercentage: 25, fixedAmount: 200000 },
              { sequence: 7, incomeFrom: 2400000, incomeTo: null, ratePercentage: 30, fixedAmount: 300000, cessRate: 4 },
            ]
          }
        }
      });
      taxSlabCount++;
    }

    const existingUSTax = await db.taxSlabTable.findFirst({ where: { name: 'US Federal Income Tax 2025 (Single)' } });
    if (!existingUSTax) {
      await db.taxSlabTable.create({
        data: {
          name: 'US Federal Income Tax 2025 (Single)',
          countryCode: 'USA',
          taxYear: '2025',
          filingStatus: 'SINGLE',
          regimeType: 'STANDARD',
          effectiveFrom: new Date('2025-01-01'),
          companyId: tcg.id,
          rateLines: {
            create: [
              { sequence: 1, incomeFrom: 0, incomeTo: 11600, ratePercentage: 10, fixedAmount: 0 },
              { sequence: 2, incomeFrom: 11600, incomeTo: 47150, ratePercentage: 12, fixedAmount: 1160 },
              { sequence: 3, incomeFrom: 47150, incomeTo: 100525, ratePercentage: 22, fixedAmount: 5426 },
              { sequence: 4, incomeFrom: 100525, incomeTo: 191950, ratePercentage: 24, fixedAmount: 17168.5 },
              { sequence: 5, incomeFrom: 191950, incomeTo: 243725, ratePercentage: 32, fixedAmount: 39110.5 },
              { sequence: 6, incomeFrom: 243725, incomeTo: 609350, ratePercentage: 35, fixedAmount: 55678.5 },
              { sequence: 7, incomeFrom: 609350, incomeTo: null, ratePercentage: 37, fixedAmount: 183647.25 },
            ]
          }
        }
      });
      taxSlabCount++;
    }
    results.push(`${taxSlabCount} tax slab tables created`);

    // ═══ CURRENCY CONFIG & EXCHANGE RATES ═══
    let ccCount = 0;
    for (const company of companies.slice(0, 3)) {
      const existing = await db.currencyConfig.findFirst({ where: { legalEntityId: company.id } });
      if (existing) continue;
      await db.currencyConfig.create({
        data: {
          legalEntityId: company.id,
          baseCurrency: company.currency || 'USD',
          payrollCurrency: company.currency || 'USD',
          reportingCurrency: company.currency || 'USD',
          exchangeRateSource: 'MANUAL',
          rateType: 'SPOT',
          roundingPrecision: 2,
          roundingRule: 'NEAREST',
          companyId: company.id,
        }
      });
      ccCount++;
    }

    const exchangeRates = [
      { fromCurrency: 'USD', toCurrency: 'INR', exchangeRate: 83.50, rateDate: new Date('2026-06-01'), rateType: 'MONTHLY_AVERAGE', source: 'RBI Reference Rate', inverseRate: 0.01198, isActive: true },
      { fromCurrency: 'INR', toCurrency: 'USD', exchangeRate: 0.01198, rateDate: new Date('2026-06-01'), rateType: 'MONTHLY_AVERAGE', source: 'RBI Reference Rate', inverseRate: 83.50, isActive: true },
      { fromCurrency: 'USD', toCurrency: 'GBP', exchangeRate: 0.79, rateDate: new Date('2026-06-01'), rateType: 'SPOT', source: 'Bloomberg', inverseRate: 1.266, isActive: true },
      { fromCurrency: 'GBP', toCurrency: 'USD', exchangeRate: 1.266, rateDate: new Date('2026-06-01'), rateType: 'SPOT', source: 'Bloomberg', inverseRate: 0.79, isActive: true },
    ];
    let erCount = 0;
    for (const er of exchangeRates) {
      const existing = await db.exchangeRate.findFirst({ where: { fromCurrency: er.fromCurrency, toCurrency: er.toCurrency, rateDate: er.rateDate } });
      if (existing) continue;
      await db.exchangeRate.create({ data: er });
      erCount++;
    }
    results.push(`${ccCount} currency configs, ${erCount} exchange rates created`);

    // ═══ DIMENSION DEFINITIONS ═══
    const dims = [
      { code: 'DEPT', name: 'Department', dimensionType: 'STANDARD', hierarchyEnabled: false, allocationMethod: 'PERCENTAGE', isMandatory: true, allowMultiple: false, maxAllocations: 1, companyId: tcg.id },
      { code: 'CC', name: 'Cost Center', dimensionType: 'STANDARD', hierarchyEnabled: true, allocationMethod: 'PERCENTAGE', isMandatory: false, allowMultiple: true, maxAllocations: 3, companyId: tcg.id },
      { code: 'LOC', name: 'Location', dimensionType: 'STANDARD', hierarchyEnabled: false, allocationMethod: 'PERCENTAGE', isMandatory: true, allowMultiple: false, maxAllocations: 1, companyId: tcg.id },
    ];
    let dimCount = 0;
    const dimMap = new Map<string, string>();
    for (const d of dims) {
      const existing = await db.dimensionDefinition.findFirst({ where: { code: d.code, companyId: d.companyId } });
      if (existing) { dimMap.set(d.code, existing.id); continue; }
      const created = await db.dimensionDefinition.create({ data: d });
      dimMap.set(d.code, created.id);
      dimCount++;
    }
    results.push(`${dimCount} dimension definitions created`);

    // ═══ PAYROLL RUNS (with fallback for Prisma compatibility) ═══
    function computeUSPayroll(annualCTC: number) {
      const monthly = annualCTC / 12;
      const base = monthly;
      const ss = Math.min(base * 0.062, 168600 / 12 * 0.062);
      const medicare = base * 0.0145;
      const fedTax = base * 0.22;
      const stateTax = base * 0.093;
      const k401 = base * 0.06;
      const totalDeductions = ss + medicare + fedTax + stateTax + k401;
      const net = base - totalDeductions;
      const erSS = Math.min(base * 0.062, 168600 / 12 * 0.062);
      const erMedicare = base * 0.0145;
      const erHealth = 850;
      return { base, ss, medicare, fedTax, stateTax, k401, totalDeductions, net, erSS, erMedicare, erHealth, gross: base };
    }

    let runsCreated = 0;
    let txLineCount = 0;
    let inputCount = 0;
    let mayRun: any = null;
    let juneRun: any = null;

    try {
      // Test if PayrollRun model works with Prisma
      await db.payrollRun.findFirst();
      console.log('[Payroll Seed] PayrollRun model works with Prisma');

      // May 2026 run (CLOSED)
      mayRun = await db.payrollRun.findFirst({ where: { payrollPeriod: '2026-05', legalEntityId: tcg.id } });
      if (!mayRun) {
        mayRun = await db.payrollRun.create({
          data: {
            legalEntityId: tcg.id, payrollPeriod: '2026-05',
            periodStartDate: new Date('2026-05-01'), periodEndDate: new Date('2026-05-31'),
            payDate: new Date('2026-05-30'), runType: 'REGULAR', runStatus: 'CLOSED',
            currencyCode: 'USD', taxProjectionMethod: 'CUMULATIVE', includeStatutory: true,
            processingMode: 'FULL', companyId: tcg.id, totalEmployees: companyEmployees.length,
            totalGrossPay: 0, totalDeductions: 0, totalNetPay: 0, totalEmployerContrib: 0,
          }
        });
        runsCreated++;
      }

      // June 2026 run (REVIEW)
      juneRun = await db.payrollRun.findFirst({ where: { payrollPeriod: '2026-06', legalEntityId: tcg.id } });
      if (!juneRun) {
        juneRun = await db.payrollRun.create({
          data: {
            legalEntityId: tcg.id, payrollPeriod: '2026-06',
            periodStartDate: new Date('2026-06-01'), periodEndDate: new Date('2026-06-30'),
            payDate: new Date('2026-06-30'), runType: 'REGULAR', runStatus: 'REVIEW',
            currencyCode: 'USD', taxProjectionMethod: 'CUMULATIVE', includeStatutory: true,
            processingMode: 'FULL', companyId: tcg.id, totalEmployees: companyEmployees.length,
            totalGrossPay: 0, totalDeductions: 0, totalNetPay: 0, totalEmployerContrib: 0,
          }
        });
        runsCreated++;
      }

      // Create transaction lines
      let totalGrossMay = 0, totalDedMay = 0, totalNetMay = 0, totalErMay = 0;
      let totalGrossJune = 0, totalDedJune = 0, totalNetJune = 0, totalErJune = 0;

      for (const emp of companyEmployees) {
        const ctc = emp.salary || 100000;
        const calc = computeUSPayroll(ctc);

        const lineDefs = [
          { componentCode: 'BASE_US', componentType: 'EARNING' as const, componentCategory: 'NORMAL' as const, amount: calc.base, taxTreatment: 'FULLY_TAXABLE' },
          { componentCode: 'FIT', componentType: 'DEDUCTION' as const, componentCategory: 'STATUTORY' as const, amount: -calc.fedTax, taxTreatment: 'EXEMPT' },
          { componentCode: 'SIT', componentType: 'DEDUCTION' as const, componentCategory: 'STATUTORY' as const, amount: -calc.stateTax, taxTreatment: 'EXEMPT' },
          { componentCode: 'SS_EE', componentType: 'EMPLOYEE_CONTRIB' as const, componentCategory: 'STATUTORY' as const, amount: -calc.ss, taxTreatment: 'EXEMPT' },
          { componentCode: 'MED_EE', componentType: 'EMPLOYEE_CONTRIB' as const, componentCategory: 'STATUTORY' as const, amount: -calc.medicare, taxTreatment: 'EXEMPT' },
          { componentCode: '401K_EE', componentType: 'DEDUCTION' as const, componentCategory: 'NORMAL' as const, amount: -calc.k401, taxTreatment: 'DEFERRED' },
          { componentCode: 'SS_ER', componentType: 'EMPLOYER_CONTRIB' as const, componentCategory: 'STATUTORY' as const, amount: calc.erSS, taxTreatment: 'EXEMPT' },
          { componentCode: 'MED_ER', componentType: 'EMPLOYER_CONTRIB' as const, componentCategory: 'STATUTORY' as const, amount: calc.erMedicare, taxTreatment: 'EXEMPT' },
          { componentCode: 'HI_ER', componentType: 'EMPLOYER_CONTRIB' as const, componentCategory: 'NORMAL' as const, amount: calc.erHealth, taxTreatment: 'EXEMPT' },
        ];

        for (const run of [mayRun, juneRun]) {
          if (!run) continue;
          for (const ld of lineDefs) {
            try {
              const existing = await db.payrollTransactionLine.findFirst({
                where: { payrollRunId: run.id, employeeId: emp.id, componentCode: ld.componentCode }
              });
              if (existing) continue;
              const glCode = ld.componentType === 'EARNING' ? '6100' : ld.componentCategory === 'STATUTORY' ? '2200' : ld.componentType === 'EMPLOYER_CONTRIB' ? '6200' : '2100';
              await db.payrollTransactionLine.create({
                data: {
                  payrollRunId: run.id, employeeId: emp.id,
                  componentId: usComponentMap.get(ld.componentCode),
                  componentCode: ld.componentCode, componentType: ld.componentType,
                  componentCategory: ld.componentCategory, calculatedAmount: ld.amount,
                  finalAmount: ld.amount, currencyCode: 'USD', prorationFactor: 1.0,
                  glAccountCode: glCode, taxTreatment: ld.taxTreatment,
                  ytdAmount: ld.amount * (run === mayRun ? 5 : 6), mtdAmount: ld.amount,
                }
              });
              txLineCount++;
            } catch { /* skip if table not Prisma-compatible */ }
          }
        }

        totalGrossMay += calc.gross; totalDedMay += calc.totalDeductions;
        totalNetMay += calc.net; totalErMay += calc.erSS + calc.erMedicare + calc.erHealth;
        totalGrossJune += calc.gross; totalDedJune += calc.totalDeductions;
        totalNetJune += calc.net; totalErJune += calc.erSS + calc.erMedicare + calc.erHealth;
      }

      // Update run totals
      if (mayRun) try { await db.payrollRun.update({ where: { id: mayRun.id }, data: { totalGrossPay: totalGrossMay, totalDeductions: totalDedMay, totalNetPay: totalNetMay, totalEmployerContrib: totalErMay } }); } catch {}
      if (juneRun) try { await db.payrollRun.update({ where: { id: juneRun.id }, data: { totalGrossPay: totalGrossJune, totalDeductions: totalDedJune, totalNetPay: totalNetJune, totalEmployerContrib: totalErJune } }); } catch {}

      // ═══ PAYROLL INPUTS ═══
      const inputEmp3 = companyEmployees.find(e => e.employeeId === 'EMP003' || e.employeeId === 'EMP-EMP' || e.employeeId === 'EMP-004');
      const inputEmp1 = companyEmployees.find(e => e.employeeId === 'EMP001' || e.employeeId === 'EMP-HR' || e.employeeId === 'EMP-002');

      if (inputEmp3 && juneRun) {
        try {
          const existing = await db.payrollInput.findFirst({ where: { payrollRunId: juneRun.id, employeeId: inputEmp3.id, inputType: 'OVERTIME' } });
          if (!existing) {
            await db.payrollInput.create({ data: { payrollRunId: juneRun.id, employeeId: inputEmp3.id, inputType: 'OVERTIME', componentCode: 'BASE_US', inputValueNumeric: 8, unitType: 'HOURS', inputDateFrom: new Date('2026-06-01'), inputDateTo: new Date('2026-06-30'), currencyCode: 'USD', approvalStatus: 'APPROVED', source: 'SYSTEM_GENERATED', remarks: 'Overtime hours - June 2026' } });
            inputCount++;
          }
        } catch {}
      }
      if (inputEmp1 && juneRun) {
        try {
          const existing = await db.payrollInput.findFirst({ where: { payrollRunId: juneRun.id, employeeId: inputEmp1.id, inputType: 'LEAVE' } });
          if (!existing) {
            await db.payrollInput.create({ data: { payrollRunId: juneRun.id, employeeId: inputEmp1.id, inputType: 'LEAVE', componentCode: 'BASE_US', inputValueNumeric: 2, unitType: 'DAYS', inputDateFrom: new Date('2026-06-15'), inputDateTo: new Date('2026-06-16'), currencyCode: 'USD', approvalStatus: 'APPROVED', source: 'SELF_SERVICE', remarks: 'Casual leave - 2 days' } });
            inputCount++;
          }
        } catch {}
      }
    } catch (e: any) {
      console.log(`[Payroll Seed] PayrollRun/TransactionLine not available via Prisma: ${e.message?.substring(0, 100)}`);
      console.log('[Payroll Seed] Skipping PayrollRun, TransactionLines, and Inputs - these will be available after prisma db push succeeds during build');
    }
    results.push(`${runsCreated} payroll runs, ${txLineCount} transaction lines, ${inputCount} inputs`);

    // ═══ COMPLIANCE OBLIGATIONS ═══
    const complianceData = [
      { name: 'EPF Monthly Return', countryCode: 'IND', authorityName: 'EPFO', filingType: 'RETURN', frequency: 'MONTHLY', dueDateRule: 'D+15', graceDays: 5, penaltyType: 'PERCENTAGE_PER_MONTH', penaltyValue: 1, responsibleRole: 'PAYROLL_ADMIN', escalationRole: 'HR_HEAD', reminderDaysBefore: '7,3,1', autoGenerate: true, filingFormat: 'ECR', companyId: mpi.id },
      { name: 'ESI Half-Yearly Return', countryCode: 'IND', authorityName: 'ESIC', filingType: 'RETURN', frequency: 'HALF_YEARLY', dueDateRule: 'D+12', graceDays: 3, penaltyType: 'PERCENTAGE_PER_MONTH', penaltyValue: 1.5, responsibleRole: 'PAYROLL_ADMIN', reminderDaysBefore: '15,7,3', autoGenerate: true, filingFormat: 'FPS', companyId: mpi.id },
      { name: 'TDS Quarterly Return (Form 24Q)', countryCode: 'IND', authorityName: 'Income Tax Department', filingType: 'RETURN', frequency: 'QUARTERLY', dueDateRule: 'MONTH_END+31', graceDays: 0, penaltyType: 'FIXED_AMOUNT', penaltyValue: 200, responsibleRole: 'PAYROLL_ADMIN', escalationRole: 'CFO', reminderDaysBefore: '15,7,3', autoGenerate: true, filingFormat: 'FORM_24Q', companyId: mpi.id },
      { name: 'Form 941 - Federal Quarterly Tax Return', countryCode: 'USA', authorityName: 'IRS', filingType: 'RETURN', frequency: 'QUARTERLY', dueDateRule: 'QUARTER_END+30', graceDays: 0, penaltyType: 'PERCENTAGE_PER_MONTH', penaltyValue: 5, responsibleRole: 'PAYROLL_ADMIN', escalationRole: 'CFO', reminderDaysBefore: '15,7,3', autoGenerate: true, filingFormat: 'FORM_941', companyId: tcg.id },
      { name: 'Form W-2 Annual Wage Statement', countryCode: 'USA', authorityName: 'IRS', filingType: 'CERTIFICATE', frequency: 'ANNUAL', dueDateRule: 'JANUARY_31', graceDays: 0, penaltyType: 'FIXED_AMOUNT', penaltyValue: 50, responsibleRole: 'PAYROLL_ADMIN', escalationRole: 'HR_HEAD', reminderDaysBefore: '30,15,7,3', autoGenerate: true, filingFormat: 'W2', companyId: tcg.id },
    ];

    let complianceCount = 0;
    for (const co of complianceData) {
      const existing = await db.complianceObligation.findFirst({ where: { name: co.name, companyId: co.companyId } });
      if (existing) continue;
      await db.complianceObligation.create({ data: co });
      complianceCount++;
    }
    results.push(`${complianceCount} compliance obligations created`);

    // ═══ GL ACCOUNT MAPPINGS ═══
    const glMappings = [
      { legalEntityId: tcg.id, componentId: usComponentMap.get('BASE_US')!, debitAccount: '6100-Salary Expense', creditAccount: '2100-Accrued Payroll', costCenterSource: 'EMPLOYEE_DEFAULT' as const, postingType: 'ACCRUAL' as const, companyId: tcg.id },
      { legalEntityId: tcg.id, componentId: usComponentMap.get('FIT')!, debitAccount: '2100-Accrued Payroll', creditAccount: '2200-Federal Tax Payable', costCenterSource: 'EMPLOYEE_DEFAULT' as const, postingType: 'ACTUAL' as const, companyId: tcg.id },
      { legalEntityId: tcg.id, componentId: usComponentMap.get('SS_EE')!, debitAccount: '2100-Accrued Payroll', creditAccount: '2220-FICA Payable', costCenterSource: 'EMPLOYEE_DEFAULT' as const, postingType: 'ACTUAL' as const, companyId: tcg.id },
      { legalEntityId: tcg.id, componentId: usComponentMap.get('SS_ER')!, debitAccount: '6110-Payroll Tax Expense', creditAccount: '2220-FICA Payable', costCenterSource: 'EMPLOYEE_DEFAULT' as const, postingType: 'BOTH' as const, companyId: tcg.id },
      { legalEntityId: tcg.id, componentId: usComponentMap.get('HI_ER')!, debitAccount: '6120-Health Insurance Expense', creditAccount: '2230-Health Insurance Payable', costCenterSource: 'EMPLOYEE_DEFAULT' as const, postingType: 'BOTH' as const, companyId: tcg.id },
    ].filter(m => m.componentId);

    let glCount = 0;
    for (const glm of glMappings) {
      const existing = await db.gLAccountMapping.findFirst({ where: { legalEntityId: glm.legalEntityId, componentId: glm.componentId } });
      if (existing) continue;
      await db.gLAccountMapping.create({ data: glm as any });
      glCount++;
    }
    results.push(`${glCount} GL account mappings created`);

    // ═══ LEGACY PAYROLL RECORDS ═══
    let payrollCount = 0;
    for (const emp of companyEmployees) {
      const ctc = emp.salary || 100000;
      const calc = computeUSPayroll(ctc);

      for (const [month, status] of [[5, 'paid'], [6, 'processed']] as const) {
        const existing = await db.payroll.findUnique({
          where: { employeeId_month_year: { employeeId: emp.id, month, year: 2026 } }
        });
        if (existing) continue;
        await db.payroll.create({
          data: {
            employeeId: emp.id, month, year: 2026,
            basicSalary: calc.base, hra: 0, da: 0, conveyance: 0, medical: 0, otherAllowances: 0,
            grossSalary: calc.gross, pf: calc.ss, esi: calc.medicare,
            tax: calc.fedTax + calc.stateTax, professionalTax: 0, otherDeductions: calc.k401,
            totalDeductions: calc.totalDeductions, netSalary: calc.net,
            currency: 'USD', status,
            ...(status === 'paid' ? { paidDate: new Date('2026-05-30') } : {}),
          }
        });
        payrollCount++;
      }
    }
    results.push(`${payrollCount} legacy payroll records created`);

    console.log('[Payroll Seed] Complete!');

    // ─── Call Enhanced Full Seed for additional sub-menu data ───
    let fullSeedResult: Record<string, number> | null = null;
    try {
      console.log('[Payroll Seed] Triggering enhanced full seed for additional sub-menu data...');
      const baseUrl = process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
      const fullSeedResp = await fetch(`${baseUrl}/api/seed/payroll/full`, { method: 'POST' });
      if (fullSeedResp.ok) {
        const fullSeedJson = await fullSeedResp.json();
        fullSeedResult = fullSeedJson.results || null;
        results.push('Enhanced full seed completed');
      } else {
        results.push('Enhanced full seed skipped (non-critical)');
      }
    } catch {
      results.push('Enhanced full seed skipped (non-critical)');
    }

    return NextResponse.json({
      success: true,
      message: 'Payroll module seeded successfully',
      results,
      fullSeed: fullSeedResult,
      stats: {
        employees: companyEmployees.length,
        companies: companies.length,
        payrollRuns: 2,
      }
    });

  } catch (error: any) {
    console.error('[Payroll Seed] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Unknown error',
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    }, { status: 500 });
  }
}
