/**
 * 3Boxes HRMS — Payroll Module Seed Script
 *
 * Seeds comprehensive sample data for the payroll module:
 *   1. Payroll Components (India + US)
 *   2. Statutory Components (EPF, ESI, Professional Tax, FICA)
 *   3. Salary Structures with Components
 *   4. CTC Templates with Component Mappings
 *   5. Tax Slab Tables (India New Regime, US Federal)
 *   6. Currency Config & Exchange Rates
 *   7. Dimension Definitions (Department, Cost Center, Location)
 *   8. Employee Dimension Allocations
 *   9. Payroll Runs (May 2026, June 2026)
 *  10. Payroll Transaction Lines
 *  11. Payroll Inputs
 *  12. Compliance Obligations & Filings
 *  13. GL Account Mappings
 *
 * Usage:
 *   npx tsx prisma/seed-payroll.ts
 */
import { PrismaClient } from '../src/generated/prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('💰 Seeding Payroll Module...');

  // ─── Fetch existing data from base seed ───────────────────────
  const companies = await prisma.company.findMany({ include: { branches: true } });
  const employees = await prisma.employee.findMany();
  const departments = await prisma.department.findMany();

  if (companies.length === 0) {
    console.error('❌ No companies found. Run the base seed (prisma/seed.ts) first.');
    process.exit(1);
  }

  const tcg = companies.find(c => c.code === 'TCG')!;
  const mpi = companies.find(c => c.code === 'MPI')!;
  const hfs = companies.find(c => c.code === 'HFS')!;

  const tcgEmployees = employees.filter(e => e.companyId === tcg.id);
  console.log(`  Found ${tcgEmployees.length} employees in TechCorp Global`);

  // ══════════════════════════════════════════════════════════════
  // 1. PAYROLL COMPONENTS — India
  // ══════════════════════════════════════════════════════════════
  console.log('\n📋 Creating Payroll Components (India)...');

  const indiaComponents = [
    // ── Earnings ──
    { code: 'BASIC', name: 'Basic Salary', componentType: 'EARNING', componentCategory: 'NORMAL', calculationType: 'PERCENTAGE', defaultValue: 40, percentageBase: 'CTC', isTaxable: true, taxTreatment: 'FULLY_TAXABLE', affectsGross: true, affectsNet: true, affectsCTC: true, countryCode: 'IND' },
    { code: 'HRA', name: 'House Rent Allowance', componentType: 'EARNING', componentCategory: 'NORMAL', calculationType: 'PERCENTAGE', defaultValue: 20, percentageBase: 'CTC', isTaxable: true, taxTreatment: 'PARTIALLY_TAXABLE', exemptionSection: '80GG/10(13A)', maxExemptionAmt: 240000, affectsGross: true, affectsNet: true, affectsCTC: true, countryCode: 'IND' },
    { code: 'DA', name: 'Dearness Allowance', componentType: 'EARNING', componentCategory: 'NORMAL', calculationType: 'PERCENTAGE', defaultValue: 10, percentageBase: 'BASIC', isTaxable: true, taxTreatment: 'FULLY_TAXABLE', affectsGross: true, affectsNet: true, affectsCTC: true, countryCode: 'IND' },
    { code: 'CONV', name: 'Conveyance Allowance', componentType: 'EARNING', componentCategory: 'NORMAL', calculationType: 'FLAT_AMOUNT', defaultValue: 3200, isTaxable: true, taxTreatment: 'FULLY_TAXABLE', affectsGross: true, affectsNet: true, affectsCTC: true, countryCode: 'IND' },
    { code: 'MED', name: 'Medical Allowance', componentType: 'EARNING', componentCategory: 'NORMAL', calculationType: 'FLAT_AMOUNT', defaultValue: 2500, isTaxable: true, taxTreatment: 'PARTIALLY_TAXABLE', exemptionSection: '80D', maxExemptionAmt: 25000, affectsGross: true, affectsNet: true, affectsCTC: true, countryCode: 'IND' },
    { code: 'SA', name: 'Special Allowance', componentType: 'EARNING', componentCategory: 'NORMAL', calculationType: 'FLAT_AMOUNT', defaultValue: 0, isTaxable: true, taxTreatment: 'FULLY_TAXABLE', affectsGross: true, affectsNet: true, affectsCTC: true, countryCode: 'IND' },
    { code: 'BONUS', name: 'Performance Bonus', componentType: 'EARNING', componentCategory: 'NORMAL', calculationType: 'PERCENTAGE', defaultValue: 10, percentageBase: 'BASIC', isTaxable: true, taxTreatment: 'FULLY_TAXABLE', affectsGross: true, affectsNet: true, affectsCTC: true, paymentFrequency: 'ANNUAL', countryCode: 'IND' },
    { code: 'LTA', name: 'Leave Travel Allowance', componentType: 'EARNING', componentCategory: 'NORMAL', calculationType: 'FLAT_AMOUNT', defaultValue: 15000, isTaxable: true, taxTreatment: 'PARTIALLY_TAXABLE', exemptionSection: '10(5)', maxExemptionAmt: 15000, affectsGross: true, affectsNet: true, affectsCTC: true, paymentFrequency: 'ANNUAL', countryCode: 'IND' },
    // ── Deductions (Employee) ──
    { code: 'EPF_EE', name: 'EPF - Employee Contribution', componentType: 'EMPLOYEE_CONTRIB', componentCategory: 'STATUTORY', calculationType: 'PERCENTAGE', defaultValue: 12, percentageBase: 'BASIC', isTaxable: false, taxTreatment: 'EXEMPT', affectsGross: false, affectsNet: true, affectsCTC: false, countryCode: 'IND' },
    { code: 'ESI_EE', name: 'ESI - Employee Contribution', componentType: 'EMPLOYEE_CONTRIB', componentCategory: 'STATUTORY', calculationType: 'PERCENTAGE', defaultValue: 0.75, percentageBase: 'GROSS', isTaxable: false, taxTreatment: 'EXEMPT', affectsGross: false, affectsNet: true, affectsCTC: false, countryCode: 'IND' },
    { code: 'PT', name: 'Professional Tax', componentType: 'DEDUCTION', componentCategory: 'STATUTORY', calculationType: 'SLAB_BASED', isTaxable: false, taxTreatment: 'EXEMPT', affectsGross: false, affectsNet: true, affectsCTC: false, countryCode: 'IND' },
    { code: 'TDS', name: 'Tax Deducted at Source', componentType: 'DEDUCTION', componentCategory: 'STATUTORY', calculationType: 'SLAB_BASED', isTaxable: false, taxTreatment: 'EXEMPT', affectsGross: false, affectsNet: true, affectsCTC: false, countryCode: 'IND' },
    { code: 'LWF_EE', name: 'Labour Welfare Fund - Employee', componentType: 'EMPLOYEE_CONTRIB', componentCategory: 'STATUTORY', calculationType: 'FLAT_AMOUNT', defaultValue: 25, isTaxable: false, taxTreatment: 'EXEMPT', affectsGross: false, affectsNet: true, affectsCTC: false, paymentFrequency: 'ANNUAL', countryCode: 'IND' },
    // ── Employer Contributions ──
    { code: 'EPF_ER', name: 'EPF - Employer Contribution', componentType: 'EMPLOYER_CONTRIB', componentCategory: 'STATUTORY', calculationType: 'PERCENTAGE', defaultValue: 12, percentageBase: 'BASIC', isTaxable: false, taxTreatment: 'EXEMPT', affectsGross: false, affectsNet: false, affectsCTC: true, countryCode: 'IND' },
    { code: 'ESI_ER', name: 'ESI - Employer Contribution', componentType: 'EMPLOYER_CONTRIB', componentCategory: 'STATUTORY', calculationType: 'PERCENTAGE', defaultValue: 3.25, percentageBase: 'GROSS', isTaxable: false, taxTreatment: 'EXEMPT', affectsGross: false, affectsNet: false, affectsCTC: true, countryCode: 'IND' },
    { code: 'LWF_ER', name: 'Labour Welfare Fund - Employer', componentType: 'EMPLOYER_CONTRIB', componentCategory: 'STATUTORY', calculationType: 'FLAT_AMOUNT', defaultValue: 75, isTaxable: false, taxTreatment: 'EXEMPT', affectsGross: false, affectsNet: false, affectsCTC: true, paymentFrequency: 'ANNUAL', countryCode: 'IND' },
  ];

  const indiaComponentMap = new Map<string, string>();
  for (const comp of indiaComponents) {
    const existing = await prisma.payrollComponent.findUnique({
      where: { code_countryCode: { code: comp.code, countryCode: comp.countryCode } }
    });
    if (existing) {
      indiaComponentMap.set(comp.code, existing.id);
      continue;
    }
    const created = await prisma.payrollComponent.create({ data: comp as any });
    indiaComponentMap.set(comp.code, created.id);
  }
  console.log(`  ✓ Created/verified ${indiaComponents.length} India payroll components`);

  // ══════════════════════════════════════════════════════════════
  // 1b. PAYROLL COMPONENTS — US
  // ══════════════════════════════════════════════════════════════
  console.log('\n📋 Creating Payroll Components (US)...');

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
  for (const comp of usComponents) {
    const existing = await prisma.payrollComponent.findUnique({
      where: { code_countryCode: { code: comp.code, countryCode: comp.countryCode } }
    });
    if (existing) {
      usComponentMap.set(comp.code, existing.id);
      continue;
    }
    const created = await prisma.payrollComponent.create({ data: comp as any });
    usComponentMap.set(comp.code, created.id);
  }
  console.log(`  ✓ Created/verified ${usComponents.length} US payroll components`);

  // ══════════════════════════════════════════════════════════════
  // 2. STATUTORY COMPONENTS
  // ══════════════════════════════════════════════════════════════
  console.log('\n📋 Creating Statutory Components...');

  const statutoryComponents = [
    {
      componentId: indiaComponentMap.get('EPF_EE')!,
      componentCode: 'EPF_EE', componentName: 'Employees Provident Fund',
      countryCode: 'IND', authorityName: 'EPFO', authorityCode: 'EPFO',
      partyType: 'BOTH', calculationBasis: 'BASIC_PAY',
      ratePercentage: 12, wageCeiling: 15000, maxContributionAmt: 1800,
      remittanceFrequency: 'MONTHLY', remittanceDueDay: 15,
      filingFrequency: 'MONTHLY', filingFormat: 'ECR',
      penaltyRatePct: 1, isChallanRequired: true, challanFormat: 'EPF_CHALLAN',
      effectiveFrom: new Date('2024-04-01'),
    },
    {
      componentId: indiaComponentMap.get('ESI_EE')!,
      componentCode: 'ESI', componentName: 'Employees State Insurance',
      countryCode: 'IND', authorityName: 'ESIC', authorityCode: 'ESIC',
      partyType: 'BOTH', calculationBasis: 'GROSS_PAY',
      ratePercentage: 4.0, wageCeiling: 21000,
      remittanceFrequency: 'MONTHLY', remittanceDueDay: 15,
      filingFrequency: 'HALF_YEARLY', filingFormat: 'FPS',
      penaltyRatePct: 1.5, isChallanRequired: true, challanFormat: 'ESI_CHALLAN',
      effectiveFrom: new Date('2024-04-01'),
    },
    {
      componentId: indiaComponentMap.get('PT')!,
      componentCode: 'PT', componentName: 'Professional Tax',
      countryCode: 'IND', authorityName: 'State Commercial Tax Department', authorityCode: 'SCTD',
      partyType: 'EMPLOYEE', calculationBasis: 'SLAB_BASED',
      remittanceFrequency: 'MONTHLY', remittanceDueDay: 20,
      filingFrequency: 'ANNUAL', filingFormat: 'PT_RETURN',
      isChallanRequired: true, challanFormat: 'PT_CHALLAN',
      effectiveFrom: new Date('2024-04-01'),
    },
    {
      componentId: indiaComponentMap.get('TDS')!,
      componentCode: 'TDS', componentName: 'Tax Deducted at Source (Income Tax)',
      countryCode: 'IND', authorityName: 'Income Tax Department', authorityCode: 'ITD',
      partyType: 'EMPLOYEE', calculationBasis: 'SLAB_BASED',
      remittanceFrequency: 'MONTHLY', remittanceDueDay: 7,
      filingFrequency: 'QUARTERLY', filingFormat: 'FORM_24Q',
      penaltyRatePct: 1.5, isChallanRequired: true, challanFormat: 'ITNS_281',
      effectiveFrom: new Date('2024-04-01'),
    },
    {
      componentId: usComponentMap.get('SS_EE')!,
      componentCode: 'SS', componentName: 'Social Security (FICA)',
      countryCode: 'USA', authorityName: 'IRS', authorityCode: 'IRS',
      partyType: 'BOTH', calculationBasis: 'GROSS_PAY',
      ratePercentage: 6.2, wageCeiling: 168600,
      remittanceFrequency: 'MONTHLY', remittanceDueDay: 15,
      filingFrequency: 'QUARTERLY', filingFormat: 'FORM_941',
      penaltyRatePct: 2, isChallanRequired: true, challanFormat: 'EFTPS',
      effectiveFrom: new Date('2025-01-01'),
    },
    {
      componentId: usComponentMap.get('MED_EE')!,
      componentCode: 'MEDICARE', componentName: 'Medicare (FICA)',
      countryCode: 'USA', authorityName: 'IRS', authorityCode: 'IRS',
      partyType: 'BOTH', calculationBasis: 'GROSS_PAY',
      ratePercentage: 1.45,
      remittanceFrequency: 'MONTHLY', remittanceDueDay: 15,
      filingFrequency: 'QUARTERLY', filingFormat: 'FORM_941',
      penaltyRatePct: 2, isChallanRequired: true, challanFormat: 'EFTPS',
      effectiveFrom: new Date('2025-01-01'),
    },
    {
      componentId: usComponentMap.get('FIT')!,
      componentCode: 'FIT', componentName: 'Federal Income Tax',
      countryCode: 'USA', authorityName: 'IRS', authorityCode: 'IRS',
      partyType: 'EMPLOYEE', calculationBasis: 'SLAB_BASED',
      remittanceFrequency: 'MONTHLY', remittanceDueDay: 15,
      filingFrequency: 'QUARTERLY', filingFormat: 'FORM_941',
      penaltyRatePct: 0.5, isChallanRequired: true, challanFormat: 'EFTPS',
      effectiveFrom: new Date('2025-01-01'),
    },
  ];

  let statutoryCreated = 0;
  for (const sc of statutoryComponents) {
    const existing = await prisma.statutoryComponent.findFirst({
      where: { componentCode: sc.componentCode, countryCode: sc.countryCode }
    });
    if (existing) continue;
    await prisma.statutoryComponent.create({ data: sc as any });
    statutoryCreated++;
  }
  console.log(`  ✓ Created ${statutoryCreated} statutory components`);

  // ══════════════════════════════════════════════════════════════
  // 3. SALARY STRUCTURES (Simple)
  // ══════════════════════════════════════════════════════════════
  console.log('\n📋 Creating Salary Structures...');

  const salaryStructures = [
    { name: 'India Standard Structure', companyId: mpi.id, country: 'IN', currency: 'INR', description: 'Standard salary structure for India employees with Basic, HRA, DA, and statutory deductions', status: 'active' },
    { name: 'US Standard Structure', companyId: tcg.id, country: 'US', currency: 'USD', description: 'Standard salary structure for US employees with Base, 401k, and FICA deductions', status: 'active' },
    { name: 'UK Standard Structure', companyId: hfs.id, country: 'GB', currency: 'GBP', description: 'Standard salary structure for UK employees with PAYE and NI contributions', status: 'active' },
    { name: 'India Senior Management', companyId: mpi.id, country: 'IN', currency: 'INR', description: 'Enhanced salary structure for senior management with higher allowances and LTA', status: 'active' },
  ];

  const structureMap = new Map<string, string>();
  for (const ss of salaryStructures) {
    const existing = await prisma.salaryStructure.findFirst({
      where: { name: ss.name, companyId: ss.companyId }
    });
    if (existing) {
      structureMap.set(ss.name, existing.id);
      continue;
    }
    const created = await prisma.salaryStructure.create({ data: ss });
    structureMap.set(ss.name, created.id);
  }
  console.log(`  ✓ Created/verified ${salaryStructures.length} salary structures`);

  // ── Salary Components for India Standard Structure ──
  const indiaStructureId = structureMap.get('India Standard Structure')!;
  const indiaSalaryComponents = [
    { salaryStructureId: indiaStructureId, name: 'Basic Salary', type: 'earning', category: 'basic', calculationType: 'percentage', value: 40, percentageOf: 'CTC', isTaxable: true, isStatutory: false, sortOrder: 1, status: 'active' },
    { salaryStructureId: indiaStructureId, name: 'House Rent Allowance', type: 'earning', category: 'hra', calculationType: 'percentage', value: 20, percentageOf: 'CTC', isTaxable: true, isStatutory: false, sortOrder: 2, status: 'active' },
    { salaryStructureId: indiaStructureId, name: 'Dearness Allowance', type: 'earning', category: 'allowance', calculationType: 'percentage', value: 10, percentageOf: 'BASIC', isTaxable: true, isStatutory: false, sortOrder: 3, status: 'active' },
    { salaryStructureId: indiaStructureId, name: 'Conveyance Allowance', type: 'earning', category: 'allowance', calculationType: 'fixed', value: 3200, isTaxable: true, isStatutory: false, sortOrder: 4, status: 'active' },
    { salaryStructureId: indiaStructureId, name: 'Medical Allowance', type: 'earning', category: 'allowance', calculationType: 'fixed', value: 2500, isTaxable: true, isStatutory: false, sortOrder: 5, status: 'active' },
    { salaryStructureId: indiaStructureId, name: 'Special Allowance', type: 'earning', category: 'allowance', calculationType: 'fixed', value: 0, isTaxable: true, isStatutory: false, sortOrder: 6, status: 'active' },
    { salaryStructureId: indiaStructureId, name: 'EPF - Employee', type: 'deduction', category: 'pf', calculationType: 'percentage', value: 12, percentageOf: 'BASIC', isTaxable: false, isStatutory: true, sortOrder: 7, status: 'active' },
    { salaryStructureId: indiaStructureId, name: 'ESI - Employee', type: 'deduction', category: 'esi', calculationType: 'percentage', value: 0.75, percentageOf: 'GROSS', isTaxable: false, isStatutory: true, sortOrder: 8, status: 'active' },
    { salaryStructureId: indiaStructureId, name: 'Professional Tax', type: 'deduction', category: 'tax', calculationType: 'fixed', value: 200, isTaxable: false, isStatutory: true, sortOrder: 9, status: 'active' },
    { salaryStructureId: indiaStructureId, name: 'TDS', type: 'deduction', category: 'tax', calculationType: 'percentage', value: 10, percentageOf: 'GROSS', isTaxable: false, isStatutory: true, sortOrder: 10, status: 'active' },
  ];

  for (const sc of indiaSalaryComponents) {
    const existing = await prisma.salaryComponent.findFirst({
      where: { salaryStructureId: sc.salaryStructureId, name: sc.name }
    });
    if (existing) continue;
    await prisma.salaryComponent.create({ data: sc });
  }

  // ── Salary Components for US Standard Structure ──
  const usStructureId = structureMap.get('US Standard Structure')!;
  const usSalaryComponents = [
    { salaryStructureId: usStructureId, name: 'Base Salary', type: 'earning', category: 'basic', calculationType: 'percentage', value: 100, percentageOf: 'CTC', isTaxable: true, isStatutory: false, sortOrder: 1, status: 'active' },
    { salaryStructureId: usStructureId, name: 'Annual Bonus', type: 'earning', category: 'bonus', calculationType: 'percentage', value: 15, percentageOf: 'BASE', isTaxable: true, isStatutory: false, sortOrder: 2, status: 'active' },
    { salaryStructureId: usStructureId, name: 'Federal Income Tax', type: 'deduction', category: 'tax', calculationType: 'percentage', value: 22, percentageOf: 'GROSS', isTaxable: false, isStatutory: true, sortOrder: 3, status: 'active' },
    { salaryStructureId: usStructureId, name: 'State Income Tax', type: 'deduction', category: 'tax', calculationType: 'percentage', value: 9.3, percentageOf: 'GROSS', isTaxable: false, isStatutory: true, sortOrder: 4, status: 'active' },
    { salaryStructureId: usStructureId, name: 'Social Security', type: 'deduction', category: 'pf', calculationType: 'percentage', value: 6.2, percentageOf: 'GROSS', isTaxable: false, isStatutory: true, sortOrder: 5, status: 'active' },
    { salaryStructureId: usStructureId, name: 'Medicare', type: 'deduction', category: 'esi', calculationType: 'percentage', value: 1.45, percentageOf: 'GROSS', isTaxable: false, isStatutory: true, sortOrder: 6, status: 'active' },
    { salaryStructureId: usStructureId, name: '401(k) Contribution', type: 'deduction', category: 'pf', calculationType: 'percentage', value: 6, percentageOf: 'BASE', isTaxable: true, isStatutory: false, maxLimit: 23000, sortOrder: 7, status: 'active' },
  ];

  for (const sc of usSalaryComponents) {
    const existing = await prisma.salaryComponent.findFirst({
      where: { salaryStructureId: sc.salaryStructureId, name: sc.name }
    });
    if (existing) continue;
    await prisma.salaryComponent.create({ data: sc });
  }
  console.log(`  ✓ Created salary structure components (India + US)`);

  // ══════════════════════════════════════════════════════════════
  // 4. CTC TEMPLATES WITH COMPONENT MAPPINGS
  // ══════════════════════════════════════════════════════════════
  console.log('\n📋 Creating CTC Templates...');

  // India CTC Template
  const indiaCTC = await prisma.cTCTemplate.upsert({
    where: { id: 'seed-india-ctc-standard' },
    update: {},
    create: {
      id: 'seed-india-ctc-standard',
      name: 'India Standard CTC Template',
      countryCode: 'IND',
      currencyCode: 'INR',
      ctcType: 'ANNUAL',
      status: 'ACTIVE',
      isDefault: true,
      basePayPct: 40,
      effectiveFrom: new Date('2025-04-01'),
      companyId: mpi.id,
    },
  });

  const indiaCTCMappings = [
    { ctcTemplateId: indiaCTC.id, componentName: 'Basic Salary', componentCategory: 'EARNING', allocationMethod: 'PERCENTAGE_OF_CTC', allocationValue: 40, calculationSequence: 1, isStatutory: false, isTaxable: true, frequency: 'MONTHLY', prorationRule: 'CALENDAR_DAYS' },
    { ctcTemplateId: indiaCTC.id, componentName: 'House Rent Allowance', componentCategory: 'EARNING', allocationMethod: 'PERCENTAGE_OF_CTC', allocationValue: 20, calculationSequence: 2, isStatutory: false, isTaxable: true, frequency: 'MONTHLY', prorationRule: 'CALENDAR_DAYS' },
    { ctcTemplateId: indiaCTC.id, componentName: 'Dearness Allowance', componentCategory: 'EARNING', allocationMethod: 'PERCENTAGE_OF_COMPONENT', allocationValue: 10, baseComponentId: indiaComponentMap.get('BASIC'), calculationSequence: 3, isStatutory: false, isTaxable: true, frequency: 'MONTHLY' },
    { ctcTemplateId: indiaCTC.id, componentName: 'Conveyance Allowance', componentCategory: 'EARNING', allocationMethod: 'FIXED_AMOUNT', allocationValue: 3200, calculationSequence: 4, isStatutory: false, isTaxable: true, frequency: 'MONTHLY' },
    { ctcTemplateId: indiaCTC.id, componentName: 'Medical Allowance', componentCategory: 'EARNING', allocationMethod: 'FIXED_AMOUNT', allocationValue: 2500, calculationSequence: 5, isStatutory: false, isTaxable: true, frequency: 'MONTHLY' },
    { ctcTemplateId: indiaCTC.id, componentName: 'Special Allowance', componentCategory: 'EARNING', allocationMethod: 'PRORATA', allocationValue: 0, calculationSequence: 6, isStatutory: false, isTaxable: true, frequency: 'MONTHLY' },
    { ctcTemplateId: indiaCTC.id, componentName: 'EPF - Employee', componentCategory: 'DEDUCTION', allocationMethod: 'PERCENTAGE_OF_COMPONENT', allocationValue: 12, baseComponentId: indiaComponentMap.get('BASIC'), calculationSequence: 7, isStatutory: true, isTaxable: false, frequency: 'MONTHLY' },
    { ctcTemplateId: indiaCTC.id, componentName: 'EPF - Employer', componentCategory: 'EMPLOYER_CONTRIBUTION', allocationMethod: 'PERCENTAGE_OF_COMPONENT', allocationValue: 12, baseComponentId: indiaComponentMap.get('BASIC'), calculationSequence: 8, isStatutory: true, isTaxable: false, frequency: 'MONTHLY' },
    { ctcTemplateId: indiaCTC.id, componentName: 'ESI - Employee', componentCategory: 'DEDUCTION', allocationMethod: 'PERCENTAGE_OF_CTC', allocationValue: 0.75, calculationSequence: 9, isStatutory: true, isTaxable: false, frequency: 'MONTHLY' },
    { ctcTemplateId: indiaCTC.id, componentName: 'Professional Tax', componentCategory: 'DEDUCTION', allocationMethod: 'FIXED_AMOUNT', allocationValue: 200, calculationSequence: 10, isStatutory: true, isTaxable: false, frequency: 'MONTHLY' },
  ];

  for (const mapping of indiaCTCMappings) {
    const existing = await prisma.cTCComponentMapping.findFirst({
      where: { ctcTemplateId: mapping.ctcTemplateId, componentName: mapping.componentName }
    });
    if (existing) continue;
    await prisma.cTCComponentMapping.create({ data: mapping as any });
  }

  // US CTC Template
  const usCTC = await prisma.cTCTemplate.upsert({
    where: { id: 'seed-us-ctc-standard' },
    update: {},
    create: {
      id: 'seed-us-ctc-standard',
      name: 'US Standard CTC Template',
      countryCode: 'USA',
      currencyCode: 'USD',
      ctcType: 'ANNUAL',
      status: 'ACTIVE',
      isDefault: true,
      basePayPct: 100,
      effectiveFrom: new Date('2025-01-01'),
      companyId: tcg.id,
    },
  });

  const usCTCMappings = [
    { ctcTemplateId: usCTC.id, componentName: 'Base Salary', componentCategory: 'EARNING', allocationMethod: 'PERCENTAGE_OF_CTC', allocationValue: 100, calculationSequence: 1, isStatutory: false, isTaxable: true, frequency: 'MONTHLY', prorationRule: 'WORKING_DAYS' },
    { ctcTemplateId: usCTC.id, componentName: 'Annual Bonus', componentCategory: 'EARNING', allocationMethod: 'PERCENTAGE_OF_COMPONENT', allocationValue: 15, baseComponentId: usComponentMap.get('BASE_US'), calculationSequence: 2, isStatutory: false, isTaxable: true, frequency: 'ANNUAL' },
    { ctcTemplateId: usCTC.id, componentName: 'Federal Income Tax', componentCategory: 'DEDUCTION', allocationMethod: 'PERCENTAGE_OF_CTC', allocationValue: 22, calculationSequence: 3, isStatutory: true, isTaxable: false, frequency: 'MONTHLY' },
    { ctcTemplateId: usCTC.id, componentName: 'State Income Tax', componentCategory: 'DEDUCTION', allocationMethod: 'PERCENTAGE_OF_CTC', allocationValue: 9.3, calculationSequence: 4, isStatutory: true, isTaxable: false, frequency: 'MONTHLY' },
    { ctcTemplateId: usCTC.id, componentName: 'Social Security', componentCategory: 'DEDUCTION', allocationMethod: 'PERCENTAGE_OF_CTC', allocationValue: 6.2, calculationSequence: 5, isStatutory: true, isTaxable: false, frequency: 'MONTHLY' },
    { ctcTemplateId: usCTC.id, componentName: 'Medicare', componentCategory: 'DEDUCTION', allocationMethod: 'PERCENTAGE_OF_CTC', allocationValue: 1.45, calculationSequence: 6, isStatutory: true, isTaxable: false, frequency: 'MONTHLY' },
    { ctcTemplateId: usCTC.id, componentName: '401(k)', componentCategory: 'DEDUCTION', allocationMethod: 'PERCENTAGE_OF_COMPONENT', allocationValue: 6, baseComponentId: usComponentMap.get('BASE_US'), calculationSequence: 7, isStatutory: false, isTaxable: true, taxExemptionLimit: 23000, frequency: 'MONTHLY' },
    { ctcTemplateId: usCTC.id, componentName: 'Health Insurance - Employer', componentCategory: 'EMPLOYER_CONTRIBUTION', allocationMethod: 'FIXED_AMOUNT', allocationValue: 850, calculationSequence: 8, isStatutory: false, isTaxable: false, frequency: 'MONTHLY' },
  ];

  for (const mapping of usCTCMappings) {
    const existing = await prisma.cTCComponentMapping.findFirst({
      where: { ctcTemplateId: mapping.ctcTemplateId, componentName: mapping.componentName }
    });
    if (existing) continue;
    await prisma.cTCComponentMapping.create({ data: mapping as any });
  }
  console.log(`  ✓ Created CTC templates with component mappings (India + US)`);

  // ══════════════════════════════════════════════════════════════
  // 5. TAX SLAB TABLES
  // ══════════════════════════════════════════════════════════════
  console.log('\n📋 Creating Tax Slab Tables...');

  // India New Tax Regime FY 2025-26
  const indiaTaxSlab = await prisma.taxSlabTable.upsert({
    where: { id: 'seed-india-tax-new-regime' },
    update: {},
    create: {
      id: 'seed-india-tax-new-regime',
      name: 'India New Tax Regime FY 2025-26',
      countryCode: 'IND',
      taxYear: '2025-26',
      filingStatus: 'SINGLE',
      regimeType: 'NEW',
      effectiveFrom: new Date('2025-04-01'),
      companyId: mpi.id,
    },
  });

  const indiaSlabRates = [
    { slabTableId: indiaTaxSlab.id, sequence: 1, incomeFrom: 0, incomeTo: 400000, ratePercentage: 0, fixedAmount: 0 },
    { slabTableId: indiaTaxSlab.id, sequence: 2, incomeFrom: 400000, incomeTo: 800000, ratePercentage: 5, fixedAmount: 0 },
    { slabTableId: indiaTaxSlab.id, sequence: 3, incomeFrom: 800000, incomeTo: 1200000, ratePercentage: 10, fixedAmount: 20000 },
    { slabTableId: indiaTaxSlab.id, sequence: 4, incomeFrom: 1200000, incomeTo: 1600000, ratePercentage: 15, fixedAmount: 60000 },
    { slabTableId: indiaTaxSlab.id, sequence: 5, incomeFrom: 1600000, incomeTo: 2000000, ratePercentage: 20, fixedAmount: 120000 },
    { slabTableId: indiaTaxSlab.id, sequence: 6, incomeFrom: 2000000, incomeTo: 2400000, ratePercentage: 25, fixedAmount: 200000 },
    { slabTableId: indiaTaxSlab.id, sequence: 7, incomeFrom: 2400000, incomeTo: null, ratePercentage: 30, fixedAmount: 300000, cessRate: 4 },
  ];

  for (const rate of indiaSlabRates) {
    const existing = await prisma.taxSlabRateLine.findFirst({
      where: { slabTableId: rate.slabTableId, sequence: rate.sequence }
    });
    if (existing) continue;
    await prisma.taxSlabRateLine.create({ data: rate as any });
  }

  // US Federal Tax Brackets 2025 (Single)
  const usTaxSlab = await prisma.taxSlabTable.upsert({
    where: { id: 'seed-us-federal-tax-2025' },
    update: {},
    create: {
      id: 'seed-us-federal-tax-2025',
      name: 'US Federal Income Tax 2025 (Single)',
      countryCode: 'USA',
      taxYear: '2025',
      filingStatus: 'SINGLE',
      regimeType: 'STANDARD',
      effectiveFrom: new Date('2025-01-01'),
      companyId: tcg.id,
    },
  });

  const usSlabRates = [
    { slabTableId: usTaxSlab.id, sequence: 1, incomeFrom: 0, incomeTo: 11600, ratePercentage: 10, fixedAmount: 0 },
    { slabTableId: usTaxSlab.id, sequence: 2, incomeFrom: 11600, incomeTo: 47150, ratePercentage: 12, fixedAmount: 1160 },
    { slabTableId: usTaxSlab.id, sequence: 3, incomeFrom: 47150, incomeTo: 100525, ratePercentage: 22, fixedAmount: 5426 },
    { slabTableId: usTaxSlab.id, sequence: 4, incomeFrom: 100525, incomeTo: 191950, ratePercentage: 24, fixedAmount: 17168.5 },
    { slabTableId: usTaxSlab.id, sequence: 5, incomeFrom: 191950, incomeTo: 243725, ratePercentage: 32, fixedAmount: 39110.5 },
    { slabTableId: usTaxSlab.id, sequence: 6, incomeFrom: 243725, incomeTo: 609350, ratePercentage: 35, fixedAmount: 55678.5 },
    { slabTableId: usTaxSlab.id, sequence: 7, incomeFrom: 609350, incomeTo: null, ratePercentage: 37, fixedAmount: 183647.25 },
  ];

  for (const rate of usSlabRates) {
    const existing = await prisma.taxSlabRateLine.findFirst({
      where: { slabTableId: rate.slabTableId, sequence: rate.sequence }
    });
    if (existing) continue;
    await prisma.taxSlabRateLine.create({ data: rate as any });
  }
  console.log(`  ✓ Created tax slab tables (India New Regime + US Federal)`);

  // ══════════════════════════════════════════════════════════════
  // 6. CURRENCY CONFIG & EXCHANGE RATES
  // ══════════════════════════════════════════════════════════════
  console.log('\n📋 Creating Currency Config & Exchange Rates...');

  const currencyConfigs = [
    { legalEntityId: tcg.id, baseCurrency: 'USD', payrollCurrency: 'USD', reportingCurrency: 'USD', exchangeRateSource: 'MANUAL', rateType: 'SPOT', autoFetchEnabled: false, roundingPrecision: 2, roundingRule: 'NEAREST', companyId: tcg.id },
    { legalEntityId: mpi.id, baseCurrency: 'INR', payrollCurrency: 'INR', reportingCurrency: 'INR', exchangeRateSource: 'CENTRAL_BANK', rateType: 'MONTHLY_AVERAGE', autoFetchEnabled: false, roundingPrecision: 2, roundingRule: 'NEAREST', companyId: mpi.id },
    { legalEntityId: hfs.id, baseCurrency: 'GBP', payrollCurrency: 'GBP', reportingCurrency: 'GBP', exchangeRateSource: 'MANUAL', rateType: 'SPOT', autoFetchEnabled: false, roundingPrecision: 2, roundingRule: 'NEAREST', companyId: hfs.id },
  ];

  for (const cc of currencyConfigs) {
    const existing = await prisma.currencyConfig.findFirst({
      where: { legalEntityId: cc.legalEntityId }
    });
    if (existing) continue;
    await prisma.currencyConfig.create({ data: cc });
  }

  const exchangeRates = [
    { fromCurrency: 'USD', toCurrency: 'INR', exchangeRate: 83.50, rateDate: new Date('2026-06-01'), rateType: 'MONTHLY_AVERAGE', source: 'RBI Reference Rate', inverseRate: 0.01198, isActive: true },
    { fromCurrency: 'INR', toCurrency: 'USD', exchangeRate: 0.01198, rateDate: new Date('2026-06-01'), rateType: 'MONTHLY_AVERAGE', source: 'RBI Reference Rate', inverseRate: 83.50, isActive: true },
    { fromCurrency: 'USD', toCurrency: 'GBP', exchangeRate: 0.79, rateDate: new Date('2026-06-01'), rateType: 'SPOT', source: 'Bloomberg', inverseRate: 1.266, isActive: true },
    { fromCurrency: 'GBP', toCurrency: 'USD', exchangeRate: 1.266, rateDate: new Date('2026-06-01'), rateType: 'SPOT', source: 'Bloomberg', inverseRate: 0.79, isActive: true },
    { fromCurrency: 'USD', toCurrency: 'EUR', exchangeRate: 0.92, rateDate: new Date('2026-06-01'), rateType: 'SPOT', source: 'ECB Reference Rate', inverseRate: 1.087, isActive: true },
    { fromCurrency: 'INR', toCurrency: 'GBP', exchangeRate: 0.00946, rateDate: new Date('2026-06-01'), rateType: 'SPOT', source: 'Cross Rate', inverseRate: 105.7, isActive: true },
  ];

  for (const er of exchangeRates) {
    const existing = await prisma.exchangeRate.findFirst({
      where: { fromCurrency: er.fromCurrency, toCurrency: er.toCurrency, rateDate: er.rateDate }
    });
    if (existing) continue;
    await prisma.exchangeRate.create({ data: er });
  }
  console.log(`  ✓ Created currency configs and exchange rates`);

  // ══════════════════════════════════════════════════════════════
  // 7. DIMENSION DEFINITIONS & ALLOCATIONS
  // ══════════════════════════════════════════════════════════════
  console.log('\n📋 Creating Dimension Definitions...');

  const dimensions = [
    { code: 'DEPT', name: 'Department', dimensionType: 'STANDARD', hierarchyEnabled: false, allocationMethod: 'PERCENTAGE', isMandatory: true, allowMultiple: false, maxAllocations: 1, companyId: tcg.id },
    { code: 'CC', name: 'Cost Center', dimensionType: 'STANDARD', hierarchyEnabled: true, allocationMethod: 'PERCENTAGE', isMandatory: false, allowMultiple: true, maxAllocations: 3, companyId: tcg.id },
    { code: 'LOC', name: 'Location', dimensionType: 'STANDARD', hierarchyEnabled: false, allocationMethod: 'PERCENTAGE', isMandatory: true, allowMultiple: false, maxAllocations: 1, companyId: tcg.id },
    { code: 'PROJ', name: 'Project', dimensionType: 'STANDARD', hierarchyEnabled: false, allocationMethod: 'PERCENTAGE', isMandatory: false, allowMultiple: true, maxAllocations: 5, companyId: tcg.id },
    { code: 'BU', name: 'Business Unit', dimensionType: 'CUSTOM', hierarchyEnabled: true, allocationMethod: 'HEADCOUNT', isMandatory: false, allowMultiple: false, maxAllocations: 1, companyId: tcg.id },
  ];

  const dimensionMap = new Map<string, string>();
  for (const dim of dimensions) {
    const existing = await prisma.dimensionDefinition.findFirst({
      where: { code: dim.code, companyId: dim.companyId }
    });
    if (existing) {
      dimensionMap.set(dim.code, existing.id);
      continue;
    }
    const created = await prisma.dimensionDefinition.create({ data: dim });
    dimensionMap.set(dim.code, created.id);
  }

  // Allocate employees to dimensions
  for (const emp of tcgEmployees) {
    const empDept = departments.find(d => d.id === emp.departmentId);
    if (!empDept) continue;

    // Department dimension
    const deptDimId = dimensionMap.get('DEPT');
    if (deptDimId) {
      const existing = await prisma.employeeDimensionAllocation.findFirst({
        where: { employeeId: emp.id, dimensionId: deptDimId }
      });
      if (!existing) {
        await prisma.employeeDimensionAllocation.create({
          data: { employeeId: emp.id, dimensionId: deptDimId, dimensionValueId: empDept.id, allocationPct: 100, isPrimary: true }
        });
      }
    }

    // Location dimension
    const locDimId = dimensionMap.get('LOC');
    if (locDimId && emp.branchId) {
      const existing = await prisma.employeeDimensionAllocation.findFirst({
        where: { employeeId: emp.id, dimensionId: locDimId }
      });
      if (!existing) {
        await prisma.employeeDimensionAllocation.create({
          data: { employeeId: emp.id, dimensionId: locDimId, dimensionValueId: emp.branchId, allocationPct: 100, isPrimary: true }
        });
      }
    }
  }
  console.log(`  ✓ Created dimension definitions and employee allocations`);

  // ══════════════════════════════════════════════════════════════
  // 8. PAYROLL RUNS + TRANSACTION LINES
  // ══════════════════════════════════════════════════════════════
  console.log('\n📋 Creating Payroll Runs & Transaction Lines...');

  // Helper: compute US payroll for an employee
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

  // ── May 2026 Payroll Run (CLOSED - completed) ──
  const mayRun = await prisma.payrollRun.upsert({
    where: { id: 'seed-payroll-run-may-2026' },
    update: {},
    create: {
      id: 'seed-payroll-run-may-2026',
      legalEntityId: tcg.id,
      payrollPeriod: '2026-05',
      periodStartDate: new Date('2026-05-01'),
      periodEndDate: new Date('2026-05-31'),
      payDate: new Date('2026-05-30'),
      runType: 'REGULAR',
      runStatus: 'CLOSED',
      currencyCode: 'USD',
      taxProjectionMethod: 'CUMULATIVE',
      includeStatutory: true,
      processingMode: 'FULL',
      companyId: tcg.id,
      totalEmployees: tcgEmployees.length,
      totalGrossPay: 0,
      totalDeductions: 0,
      totalNetPay: 0,
      totalEmployerContrib: 0,
    },
  });

  // ── June 2026 Payroll Run (REVIEW - in progress) ──
  const juneRun = await prisma.payrollRun.upsert({
    where: { id: 'seed-payroll-run-june-2026' },
    update: {},
    create: {
      id: 'seed-payroll-run-june-2026',
      legalEntityId: tcg.id,
      payrollPeriod: '2026-06',
      periodStartDate: new Date('2026-06-01'),
      periodEndDate: new Date('2026-06-30'),
      payDate: new Date('2026-06-30'),
      runType: 'REGULAR',
      runStatus: 'REVIEW',
      currencyCode: 'USD',
      taxProjectionMethod: 'CUMULATIVE',
      includeStatutory: true,
      processingMode: 'FULL',
      companyId: tcg.id,
      totalEmployees: tcgEmployees.length,
      totalGrossPay: 0,
      totalDeductions: 0,
      totalNetPay: 0,
      totalEmployerContrib: 0,
    },
  });

  // Create transaction lines for each employee for each run
  let totalGrossMay = 0, totalDedMay = 0, totalNetMay = 0, totalErMay = 0;
  let totalGrossJune = 0, totalDedJune = 0, totalNetJune = 0, totalErJune = 0;

  for (const emp of tcgEmployees) {
    const ctc = emp.salary || 100000;
    const calc = computeUSPayroll(ctc);

    // Transaction line definitions for a US employee
    const lineDefs = [
      { componentCode: 'BASE_US', componentType: 'EARNING', componentCategory: 'NORMAL', amount: calc.base, taxTreatment: 'FULLY_TAXABLE' },
      { componentCode: 'FIT', componentType: 'DEDUCTION', componentCategory: 'STATUTORY', amount: -calc.fedTax, taxTreatment: 'EXEMPT' },
      { componentCode: 'SIT', componentType: 'DEDUCTION', componentCategory: 'STATUTORY', amount: -calc.stateTax, taxTreatment: 'EXEMPT' },
      { componentCode: 'SS_EE', componentType: 'EMPLOYEE_CONTRIB', componentCategory: 'STATUTORY', amount: -calc.ss, taxTreatment: 'EXEMPT' },
      { componentCode: 'MED_EE', componentType: 'EMPLOYEE_CONTRIB', componentCategory: 'STATUTORY', amount: -calc.medicare, taxTreatment: 'EXEMPT' },
      { componentCode: '401K_EE', componentType: 'DEDUCTION', componentCategory: 'NORMAL', amount: -calc.k401, taxTreatment: 'DEFERRED' },
      { componentCode: 'SS_ER', componentType: 'EMPLOYER_CONTRIB', componentCategory: 'STATUTORY', amount: calc.erSS, taxTreatment: 'EXEMPT' },
      { componentCode: 'MED_ER', componentType: 'EMPLOYER_CONTRIB', componentCategory: 'STATUTORY', amount: calc.erMedicare, taxTreatment: 'EXEMPT' },
      { componentCode: 'HI_ER', componentType: 'EMPLOYER_CONTRIB', componentCategory: 'NORMAL', amount: calc.erHealth, taxTreatment: 'EXEMPT' },
    ];

    // May 2026 lines
    for (const ld of lineDefs) {
      const existing = await prisma.payrollTransactionLine.findFirst({
        where: { payrollRunId: mayRun.id, employeeId: emp.id, componentCode: ld.componentCode }
      });
      if (existing) continue;

      const absAmt = Math.abs(ld.amount);
      const componentId = usComponentMap.get(ld.componentCode);
      const glCode = ld.componentType === 'EARNING' ? '6100' : ld.componentCategory === 'STATUTORY' ? '2200' : ld.componentType === 'EMPLOYER_CONTRIB' ? '6200' : '2100';

      await prisma.payrollTransactionLine.create({
        data: {
          payrollRunId: mayRun.id,
          employeeId: emp.id,
          componentId: componentId,
          componentCode: ld.componentCode,
          componentType: ld.componentType as any,
          componentCategory: ld.componentCategory as any,
          calculatedAmount: ld.amount,
          finalAmount: ld.amount,
          currencyCode: 'USD',
          prorationFactor: 1.0,
          glAccountCode: glCode,
          taxTreatment: ld.taxTreatment,
          ytdAmount: ld.amount * 5, // May is 5th month
          mtdAmount: ld.amount,
          dimensionSplitJson: ld.componentType === 'EARNING' ? JSON.stringify({ DEPT: { [emp.departmentId || 'unknown']: 100 } }) : null,
        },
      });
    }

    totalGrossMay += calc.gross;
    totalDedMay += calc.totalDeductions;
    totalNetMay += calc.net;
    totalErMay += calc.erSS + calc.erMedicare + calc.erHealth;

    // June 2026 lines
    for (const ld of lineDefs) {
      const existing = await prisma.payrollTransactionLine.findFirst({
        where: { payrollRunId: juneRun.id, employeeId: emp.id, componentCode: ld.componentCode }
      });
      if (existing) continue;

      const componentId = usComponentMap.get(ld.componentCode);
      const glCode = ld.componentType === 'EARNING' ? '6100' : ld.componentCategory === 'STATUTORY' ? '2200' : ld.componentType === 'EMPLOYER_CONTRIB' ? '6200' : '2100';

      await prisma.payrollTransactionLine.create({
        data: {
          payrollRunId: juneRun.id,
          employeeId: emp.id,
          componentId: componentId,
          componentCode: ld.componentCode,
          componentType: ld.componentType as any,
          componentCategory: ld.componentCategory as any,
          calculatedAmount: ld.amount,
          finalAmount: ld.amount,
          currencyCode: 'USD',
          prorationFactor: 1.0,
          glAccountCode: glCode,
          taxTreatment: ld.taxTreatment,
          ytdAmount: ld.amount * 6, // June is 6th month
          mtdAmount: ld.amount,
          dimensionSplitJson: ld.componentType === 'EARNING' ? JSON.stringify({ DEPT: { [emp.departmentId || 'unknown']: 100 } }) : null,
        },
      });
    }

    totalGrossJune += calc.gross;
    totalDedJune += calc.totalDeductions;
    totalNetJune += calc.net;
    totalErJune += calc.erSS + calc.erMedicare + calc.erHealth;
  }

  // Update run totals
  await prisma.payrollRun.update({ where: { id: mayRun.id }, data: { totalGrossPay: totalGrossMay, totalDeductions: totalDedMay, totalNetPay: totalNetMay, totalEmployerContrib: totalErMay } });
  await prisma.payrollRun.update({ where: { id: juneRun.id }, data: { totalGrossPay: totalGrossJune, totalDeductions: totalDedJune, totalNetPay: totalNetJune, totalEmployerContrib: totalErJune } });
  console.log(`  ✓ Created 2 payroll runs (May: CLOSED, June: REVIEW) with transaction lines for ${tcgEmployees.length} employees`);

  // ══════════════════════════════════════════════════════════════
  // 9. PAYROLL INPUTS
  // ══════════════════════════════════════════════════════════════
  console.log('\n📋 Creating Payroll Inputs...');

  const payrollInputs = [
    // Overtime input for Raj (EMP003) in June run
    { payrollRunId: juneRun.id, employeeId: tcgEmployees.find(e => e.employeeId === 'EMP003')?.id, inputType: 'OVERTIME', componentCode: 'BASE_US', inputValueNumeric: 8, unitType: 'HOURS', inputDateFrom: new Date('2026-06-01'), inputDateTo: new Date('2026-06-30'), currencyCode: 'USD', approvalStatus: 'APPROVED', source: 'SYSTEM_GENERATED', remarks: 'Overtime hours - June 2026' },
    // Leave input for Sarah (EMP001) in June run
    { payrollRunId: juneRun.id, employeeId: tcgEmployees.find(e => e.employeeId === 'EMP001')?.id, inputType: 'LEAVE', componentCode: 'BASE_US', inputValueNumeric: 2, unitType: 'DAYS', inputDateFrom: new Date('2026-06-15'), inputDateTo: new Date('2026-06-16'), currencyCode: 'USD', approvalStatus: 'APPROVED', source: 'SELF_SERVICE', remarks: 'Casual leave - 2 days' },
    // Variable pay for Priya (EMP002) in June run
    { payrollRunId: juneRun.id, employeeId: tcgEmployees.find(e => e.employeeId === 'EMP002')?.id, inputType: 'VARIABLE_PAY', componentCode: 'BONUS_US', inputValueNumeric: 2500, unitType: 'AMOUNT', inputDateFrom: new Date('2026-06-01'), inputDateTo: new Date('2026-06-30'), currencyCode: 'USD', approvalStatus: 'PENDING', source: 'MANUAL', remarks: 'Q2 performance bonus' },
    // One-time reimbursement for Kim (EMP004)
    { payrollRunId: juneRun.id, employeeId: tcgEmployees.find(e => e.employeeId === 'EMP004')?.id, inputType: 'REIMBURSEMENT', componentCode: 'BASE_US', inputValueNumeric: 500, unitType: 'AMOUNT', inputDateFrom: new Date('2026-06-10'), inputDateTo: new Date('2026-06-10'), currencyCode: 'USD', approvalStatus: 'APPROVED', source: 'SELF_SERVICE', remarks: 'Travel reimbursement - client visit' },
  ].filter(input => input.employeeId); // Filter out any with undefined employeeId

  for (const pi of payrollInputs) {
    const existing = await prisma.payrollInput.findFirst({
      where: { payrollRunId: pi.payrollRunId, employeeId: pi.employeeId!, inputType: pi.inputType, componentCode: pi.componentCode }
    });
    if (existing) continue;
    await prisma.payrollInput.create({ data: pi as any });
  }
  console.log(`  ✓ Created ${payrollInputs.length} payroll inputs`);

  // ══════════════════════════════════════════════════════════════
  // 10. COMPLIANCE OBLIGATIONS & FILINGS
  // ══════════════════════════════════════════════════════════════
  console.log('\n📋 Creating Compliance Obligations & Filings...');

  const complianceObligations = [
    { name: 'EPF Monthly Return', countryCode: 'IND', authorityName: 'EPFO', filingType: 'RETURN', frequency: 'MONTHLY', dueDateRule: 'D+15', graceDays: 5, penaltyType: 'PERCENTAGE_PER_MONTH', penaltyValue: 1, responsibleRole: 'PAYROLL_ADMIN', escalationRole: 'HR_HEAD', reminderDaysBefore: '7,3,1', autoGenerate: true, filingFormat: 'ECR', companyId: mpi.id },
    { name: 'ESI Half-Yearly Return', countryCode: 'IND', authorityName: 'ESIC', filingType: 'RETURN', frequency: 'HALF_YEARLY', dueDateRule: 'D+12', graceDays: 3, penaltyType: 'PERCENTAGE_PER_MONTH', penaltyValue: 1.5, responsibleRole: 'PAYROLL_ADMIN', reminderDaysBefore: '15,7,3', autoGenerate: true, filingFormat: 'FPS', companyId: mpi.id },
    { name: 'TDS Quarterly Return (Form 24Q)', countryCode: 'IND', authorityName: 'Income Tax Department', filingType: 'RETURN', frequency: 'QUARTERLY', dueDateRule: 'MONTH_END+31', graceDays: 0, penaltyType: 'FIXED_AMOUNT', penaltyValue: 200, responsibleRole: 'PAYROLL_ADMIN', escalationRole: 'CFO', reminderDaysBefore: '15,7,3', autoGenerate: true, filingFormat: 'FORM_24Q', companyId: mpi.id },
    { name: 'Professional Tax Annual Return', countryCode: 'IND', authorityName: 'State Commercial Tax Department', filingType: 'RETURN', frequency: 'ANNUAL', dueDateRule: 'MARCH_31', graceDays: 15, penaltyType: 'FIXED_AMOUNT', penaltyValue: 1000, responsibleRole: 'PAYROLL_ADMIN', reminderDaysBefore: '30,15,7', autoGenerate: false, filingFormat: 'PT_RETURN', companyId: mpi.id },
    { name: 'Form 941 - Federal Quarterly Tax Return', countryCode: 'USA', authorityName: 'IRS', filingType: 'RETURN', frequency: 'QUARTERLY', dueDateRule: 'QUARTER_END+30', graceDays: 0, penaltyType: 'PERCENTAGE_PER_MONTH', penaltyValue: 5, responsibleRole: 'PAYROLL_ADMIN', escalationRole: 'CFO', reminderDaysBefore: '15,7,3', autoGenerate: true, filingFormat: 'FORM_941', companyId: tcg.id },
    { name: 'Form W-2 Annual Wage Statement', countryCode: 'USA', authorityName: 'IRS', filingType: 'CERTIFICATE', frequency: 'ANNUAL', dueDateRule: 'JANUARY_31', graceDays: 0, penaltyType: 'FIXED_AMOUNT', penaltyValue: 50, responsibleRole: 'PAYROLL_ADMIN', escalationRole: 'HR_HEAD', reminderDaysBefore: '30,15,7,3', autoGenerate: true, filingFormat: 'W2', companyId: tcg.id },
  ];

  const complianceMap = new Map<string, string>();
  for (const co of complianceObligations) {
    const existing = await prisma.complianceObligation.findFirst({
      where: { name: co.name, companyId: co.companyId }
    });
    if (existing) {
      complianceMap.set(co.name, existing.id);
      continue;
    }
    const created = await prisma.complianceObligation.create({ data: co });
    complianceMap.set(co.name, created.id);
  }

  // Create sample filings
  const complianceFilings = [
    { complianceId: complianceMap.get('Form 941 - Federal Quarterly Tax Return')!, payrollRunId: mayRun.id, filingPeriod: '2026-Q1', filingStatus: 'SUBMITTED', generatedDate: new Date('2026-04-01'), submittedDate: new Date('2026-04-25'), acknowledgementRef: 'IRS-941-2026Q1-001', filingAmount: totalDedMay * 0.4, submittedBy: 'system' },
    { complianceId: complianceMap.get('EPF Monthly Return')!, payrollRunId: null, filingPeriod: '2026-05', filingStatus: 'ACKNOWLEDGED', generatedDate: new Date('2026-05-01'), submittedDate: new Date('2026-05-14'), acknowledgementRef: 'EPF-ECR-202605-001', filingAmount: 45000, submittedBy: 'system' },
    { complianceId: complianceMap.get('TDS Quarterly Return (Form 24Q)')!, payrollRunId: null, filingPeriod: '2026-Q1', filingStatus: 'GENERATED', generatedDate: new Date('2026-06-01'), filingAmount: 120000 },
  ].filter(f => f.complianceId);

  for (const cf of complianceFilings) {
    const existing = await prisma.complianceFiling.findFirst({
      where: { complianceId: cf.complianceId, filingPeriod: cf.filingPeriod }
    });
    if (existing) continue;
    await prisma.complianceFiling.create({ data: cf as any });
  }
  console.log(`  ✓ Created ${complianceObligations.length} compliance obligations and ${complianceFilings.length} filings`);

  // ══════════════════════════════════════════════════════════════
  // 11. GL ACCOUNT MAPPINGS
  // ══════════════════════════════════════════════════════════════
  console.log('\n📋 Creating GL Account Mappings...');

  const glMappings = [
    // US mappings
    { legalEntityId: tcg.id, componentId: usComponentMap.get('BASE_US')!, debitAccount: '6100-Salary Expense', creditAccount: '2100-Accrued Payroll', costCenterSource: 'EMPLOYEE_DEFAULT', postingType: 'ACCRUAL', companyId: tcg.id },
    { legalEntityId: tcg.id, componentId: usComponentMap.get('FIT')!, debitAccount: '2100-Accrued Payroll', creditAccount: '2200-Federal Tax Payable', costCenterSource: 'EMPLOYEE_DEFAULT', postingType: 'ACTUAL', companyId: tcg.id },
    { legalEntityId: tcg.id, componentId: usComponentMap.get('SIT')!, debitAccount: '2100-Accrued Payroll', creditAccount: '2210-State Tax Payable', costCenterSource: 'EMPLOYEE_DEFAULT', postingType: 'ACTUAL', companyId: tcg.id },
    { legalEntityId: tcg.id, componentId: usComponentMap.get('SS_EE')!, debitAccount: '2100-Accrued Payroll', creditAccount: '2220-FICA Payable', costCenterSource: 'EMPLOYEE_DEFAULT', postingType: 'ACTUAL', companyId: tcg.id },
    { legalEntityId: tcg.id, componentId: usComponentMap.get('MED_EE')!, debitAccount: '2100-Accrued Payroll', creditAccount: '2220-FICA Payable', costCenterSource: 'EMPLOYEE_DEFAULT', postingType: 'ACTUAL', companyId: tcg.id },
    { legalEntityId: tcg.id, componentId: usComponentMap.get('SS_ER')!, debitAccount: '6110-Payroll Tax Expense', creditAccount: '2220-FICA Payable', costCenterSource: 'EMPLOYEE_DEFAULT', postingType: 'BOTH', companyId: tcg.id },
    { legalEntityId: tcg.id, componentId: usComponentMap.get('MED_ER')!, debitAccount: '6110-Payroll Tax Expense', creditAccount: '2220-FICA Payable', costCenterSource: 'EMPLOYEE_DEFAULT', postingType: 'BOTH', companyId: tcg.id },
    { legalEntityId: tcg.id, componentId: usComponentMap.get('HI_ER')!, debitAccount: '6120-Health Insurance Expense', creditAccount: '2230-Health Insurance Payable', costCenterSource: 'EMPLOYEE_DEFAULT', postingType: 'BOTH', companyId: tcg.id },
    // India mappings
    { legalEntityId: mpi.id, componentId: indiaComponentMap.get('BASIC')!, debitAccount: '6100-Salary Expense', creditAccount: '2100-Accrued Payroll', costCenterSource: 'EMPLOYEE_DEFAULT', postingType: 'ACCRUAL', companyId: mpi.id },
    { legalEntityId: mpi.id, componentId: indiaComponentMap.get('HRA')!, debitAccount: '6101-HRA Expense', creditAccount: '2100-Accrued Payroll', costCenterSource: 'EMPLOYEE_DEFAULT', postingType: 'ACCRUAL', companyId: mpi.id },
    { legalEntityId: mpi.id, componentId: indiaComponentMap.get('EPF_EE')!, debitAccount: '2100-Accrued Payroll', creditAccount: '2200-EPF Payable', costCenterSource: 'EMPLOYEE_DEFAULT', postingType: 'ACTUAL', companyId: mpi.id },
    { legalEntityId: mpi.id, componentId: indiaComponentMap.get('EPF_ER')!, debitAccount: '6110-PF Expense', creditAccount: '2200-EPF Payable', costCenterSource: 'EMPLOYEE_DEFAULT', postingType: 'BOTH', companyId: mpi.id },
    { legalEntityId: mpi.id, componentId: indiaComponentMap.get('ESI_EE')!, debitAccount: '2100-Accrued Payroll', creditAccount: '2210-ESI Payable', costCenterSource: 'EMPLOYEE_DEFAULT', postingType: 'ACTUAL', companyId: mpi.id },
    { legalEntityId: mpi.id, componentId: indiaComponentMap.get('PT')!, debitAccount: '2100-Accrued Payroll', creditAccount: '2220-PT Payable', costCenterSource: 'EMPLOYEE_DEFAULT', postingType: 'ACTUAL', companyId: mpi.id },
    { legalEntityId: mpi.id, componentId: indiaComponentMap.get('TDS')!, debitAccount: '2100-Accrued Payroll', creditAccount: '2230-TDS Payable', costCenterSource: 'EMPLOYEE_DEFAULT', postingType: 'ACTUAL', companyId: mpi.id },
  ].filter(m => m.componentId);

  for (const glm of glMappings) {
    const existing = await prisma.gLAccountMapping.findFirst({
      where: { legalEntityId: glm.legalEntityId, componentId: glm.componentId }
    });
    if (existing) continue;
    await prisma.gLAccountMapping.create({ data: glm as any });
  }
  console.log(`  ✓ Created ${glMappings.length} GL account mappings`);

  // ══════════════════════════════════════════════════════════════
  // 12. LEGACY PAYROLL RECORDS (simple Payroll model)
  // ══════════════════════════════════════════════════════════════
  console.log('\n📋 Creating Legacy Payroll Records...');

  for (const emp of tcgEmployees) {
    const ctc = emp.salary || 100000;
    const calc = computeUSPayroll(ctc);

    // May 2026 payroll record
    const existingMay = await prisma.payroll.findUnique({
      where: { employeeId_month_year: { employeeId: emp.id, month: 5, year: 2026 } }
    });
    if (!existingMay) {
      await prisma.payroll.create({
        data: {
          employeeId: emp.id,
          month: 5,
          year: 2026,
          basicSalary: calc.base,
          hra: 0,
          da: 0,
          conveyance: 0,
          medical: 0,
          otherAllowances: 0,
          grossSalary: calc.gross,
          pf: calc.ss,
          esi: calc.medicare,
          tax: calc.fedTax + calc.stateTax,
          professionalTax: 0,
          otherDeductions: calc.k401,
          totalDeductions: calc.totalDeductions,
          netSalary: calc.net,
          currency: 'USD',
          status: 'paid',
          paidDate: new Date('2026-05-30'),
        },
      });
    }

    // June 2026 payroll record
    const existingJune = await prisma.payroll.findUnique({
      where: { employeeId_month_year: { employeeId: emp.id, month: 6, year: 2026 } }
    });
    if (!existingJune) {
      await prisma.payroll.create({
        data: {
          employeeId: emp.id,
          month: 6,
          year: 2026,
          basicSalary: calc.base,
          hra: 0,
          da: 0,
          conveyance: 0,
          medical: 0,
          otherAllowances: 0,
          grossSalary: calc.gross,
          pf: calc.ss,
          esi: calc.medicare,
          tax: calc.fedTax + calc.stateTax,
          professionalTax: 0,
          otherDeductions: calc.k401,
          totalDeductions: calc.totalDeductions,
          netSalary: calc.net,
          currency: 'USD',
          status: 'processed',
        },
      });
    }
  }
  console.log(`  ✓ Created legacy payroll records for ${tcgEmployees.length} employees (May + June 2026)`);

  // ══════════════════════════════════════════════════════════════
  // 14. PAYROLL DEFINITIONS
  // ══════════════════════════════════════════════════════════════
  console.log('\n📋 Creating Payroll Definitions...');

  const payrollDefinitions = [
    { name: 'India Monthly Payroll', companyId: mpi.id, payFrequency: 'MONTHLY', processingCutOff: 25, paymentDay: 1, currencyCode: 'INR', countryCode: 'IN', allowDirectDeposit: true, allowCheque: true, allowCash: false, costingSegments: JSON.stringify(['department', 'cost_center', 'location']), status: 'active', effectiveFrom: new Date('2025-04-01') },
    { name: 'US Bi-Weekly Payroll', companyId: tcg.id, payFrequency: 'BI_WEEKLY', processingCutOff: 15, paymentDay: 15, currencyCode: 'USD', countryCode: 'US', allowDirectDeposit: true, allowCheque: false, allowCash: false, costingSegments: JSON.stringify(['department', 'location']), status: 'active', effectiveFrom: new Date('2025-01-01') },
    { name: 'UK Monthly Payroll', companyId: hfs.id, payFrequency: 'MONTHLY', processingCutOff: 20, paymentDay: 28, currencyCode: 'GBP', countryCode: 'GB', allowDirectDeposit: true, allowCheque: true, allowCash: false, costingSegments: JSON.stringify(['department', 'project']), status: 'active', effectiveFrom: new Date('2025-04-01') },
  ];

  let payrollDefCreated = 0;
  for (const pd of payrollDefinitions) {
    const existing = await prisma.payrollDefinition.findFirst({ where: { name: pd.name, companyId: pd.companyId } });
    if (existing) continue;
    await prisma.payrollDefinition.create({ data: pd });
    payrollDefCreated++;
  }
  console.log(`  ✓ Created ${payrollDefCreated} payroll definitions`);

  // ══════════════════════════════════════════════════════════════
  // 15. EMPLOYEE PAYMENT METHODS
  // ══════════════════════════════════════════════════════════════
  console.log('\n📋 Creating Employee Payment Methods...');

  let paymentMethodsCreated = 0;
  for (const emp of employees.slice(0, 10)) {
    const existing = await prisma.employeePaymentMethod.findFirst({ where: { employeeId: emp.id, isPrimary: true } });
    if (existing) continue;

    // Primary payment method (full salary)
    await prisma.employeePaymentMethod.create({
      data: {
        employeeId: emp.id,
        paymentType: 'DIRECT_DEPOSIT',
        bankName: emp.bankName || 'HDFC Bank',
        bankAccountNo: emp.bankAccountNo || `${Math.floor(10000000000 + Math.random() * 90000000000)}`,
        bankIfscCode: emp.bankIfscCode || 'HDFC0001234',
        bankBranch: emp.city || 'Mumbai',
        accountType: 'SALARY',
        currencyCode: emp.salaryCurrency || 'INR',
        splitType: null,
        splitValue: null,
        isPrimary: true,
        priority: 1,
        status: 'active',
      },
    });
    paymentMethodsCreated++;
  }
  console.log(`  ✓ Created ${paymentMethodsCreated} employee payment methods`);

  // ══════════════════════════════════════════════════════════════
  // 16. LOANS
  // ══════════════════════════════════════════════════════════════
  console.log('\n📋 Creating Sample Loans...');

  const loanData = [
    { loanType: 'PERSONAL', loanAmount: 100000, interestRate: 10, tenureMonths: 12, emiAmount: 8791.59, outstandingBalance: 100000, disbursedAmount: 100000, disbursedDate: new Date('2026-01-15'), startDate: new Date('2026-01-15'), endDate: new Date('2027-01-15'), recoveredAmount: 35166.36, remainingEmis: 8, status: 'active' },
    { loanType: 'EMERGENCY', loanAmount: 50000, interestRate: 8, tenureMonths: 6, emiAmount: 8553.74, outstandingBalance: 50000, disbursedAmount: 50000, disbursedDate: new Date('2026-03-01'), startDate: new Date('2026-03-01'), endDate: new Date('2026-09-01'), recoveredAmount: 17107.48, remainingEmis: 4, status: 'active' },
    { loanType: 'HOUSING', loanAmount: 500000, interestRate: 7.5, tenureMonths: 60, emiAmount: 10015.87, outstandingBalance: 500000, disbursedAmount: 500000, disbursedDate: new Date('2025-06-01'), startDate: new Date('2025-06-01'), endDate: new Date('2030-06-01'), recoveredAmount: 120190.44, remainingEmis: 48, status: 'active' },
    { loanType: 'FESTIVAL', loanAmount: 25000, interestRate: 0, tenureMonths: 10, emiAmount: 2500, outstandingBalance: 25000, disbursedAmount: 25000, disbursedDate: new Date('2026-04-01'), startDate: new Date('2026-04-01'), endDate: new Date('2027-02-01'), recoveredAmount: 5000, remainingEmis: 8, status: 'active' },
    { loanType: 'EDUCATION', loanAmount: 200000, interestRate: 5, tenureMonths: 36, emiAmount: 5994.25, outstandingBalance: 200000, disbursedAmount: 200000, status: 'pending' },
  ];

  let loansCreated = 0;
  for (let i = 0; i < Math.min(loanData.length, employees.length); i++) {
    const emp = employees[i];
    const loan = loanData[i];
    const existing = await prisma.loan.findFirst({ where: { employeeId: emp.id, loanType: loan.loanType } });
    if (existing) continue;
    await prisma.loan.create({ data: { employeeId: emp.id, ...loan } });
    loansCreated++;
  }
  console.log(`  ✓ Created ${loansCreated} sample loans`);

  // ══════════════════════════════════════════════════════════════
  // 17. OVERTIME RECORDS
  // ══════════════════════════════════════════════════════════════
  console.log('\n📋 Creating Sample Overtime Records...');

  let overtimeCreated = 0;
  const otDates = [new Date('2026-05-15'), new Date('2026-05-22'), new Date('2026-06-01'), new Date('2026-06-05')];
  for (let i = 0; i < Math.min(otDates.length, employees.length); i++) {
    const emp = employees[i];
    const date = otDates[i];
    const hours = 2 + Math.random() * 4;
    const rate = (emp.salary || 50000) / 30 / 8; // Daily rate / 8 hours
    const amount = Math.round(hours * rate * 100) / 100;
    const existing = await prisma.overtimeRecord.findUnique({ where: { employeeId_date: { employeeId: emp.id, date } } });
    if (existing) continue;
    await prisma.overtimeRecord.create({
      data: { employeeId: emp.id, date, hours: Math.round(hours * 10) / 10, rateType: 'HOURLY_RATE', rate: Math.round(rate * 100) / 100, amount, reason: 'Project deadline delivery', status: i < 2 ? 'approved' : 'pending' },
    });
    overtimeCreated++;
  }
  console.log(`  ✓ Created ${overtimeCreated} overtime records`);

  // ══════════════════════════════════════════════════════════════
  // SUMMARY
  // ══════════════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(60));
  console.log('💰 PAYROLL MODULE SEED COMPLETE');
  console.log('═'.repeat(60));
  console.log(`
  Created:
    ✅ ${indiaComponents.length} India Payroll Components
    ✅ ${usComponents.length} US Payroll Components
    ✅ ${statutoryCreated} Statutory Components (EPF, ESI, PT, TDS, FICA)
    ✅ ${salaryStructures.length} Salary Structures (India, US, UK, Senior Mgmt)
    ✅ 2 CTC Templates with component mappings
    ✅ 2 Tax Slab Tables (India New Regime FY25-26, US Federal 2025)
    ✅ 3 Currency Configs + 6 Exchange Rates
    ✅ 5 Dimension Definitions with employee allocations
    ✅ 2 Payroll Runs (May: CLOSED, June: REVIEW)
    ✅ ~${tcgEmployees.length * 9 * 2} Transaction Lines
    ✅ ${payrollInputs.length} Payroll Inputs (Overtime, Leave, Variable Pay, Reimbursement)
    ✅ ${complianceObligations.length} Compliance Obligations + ${complianceFilings.length} Filings
    ✅ ${glMappings.length} GL Account Mappings
    ✅ ${tcgEmployees.length * 2} Legacy Payroll Records (May + June)
    ✅ ${payrollDefCreated} Payroll Definitions
    ✅ ${paymentMethodsCreated} Employee Payment Methods
    ✅ ${loansCreated} Loans
    ✅ ${overtimeCreated} Overtime Records
  `);
}

main()
  .catch((e) => {
    console.error('❌ Payroll seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
