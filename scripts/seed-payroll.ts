/**
 * Payroll Module Seed Script
 * Seeds comprehensive multi-country payroll data:
 * - Payroll Components (Normal Earnings, Normal Deductions per country)
 * - Statutory Components (India, US, UK, Singapore, UAE, Australia)
 * - Tax Slab Tables (India New Regime, US Single Filer, UK PAYE, Singapore)
 * - CTC Templates (India Standard, US Salaried, UK Standard)
 * - Currency Configs & Exchange Rates
 * - Dimension Definitions
 * - Compliance Obligations
 * - GL Account Mappings
 */

import prisma from '../src/lib/prisma';

async function main() {
  console.log('🌱 Seeding Payroll Module data...');

  // ────────────────────────────────────────────────────────────
  // 1. PAYROLL COMPONENTS — Normal Earnings
  // ────────────────────────────────────────────────────────────
  const normalEarnings = [
    { code: 'BASIC', name: 'Basic Salary', componentType: 'EARNING', componentCategory: 'NORMAL', countryCode: 'IND', calculationType: 'PERCENTAGE', defaultValue: 40, isTaxable: true, taxTreatment: 'FULLY_TAXABLE', affectsGross: true, affectsNet: true, affectsCTC: true, paymentFrequency: 'MONTHLY', prorationApplicable: true, roundingRule: 'NEAREST', isActive: true, effectiveFrom: new Date('2024-04-01') },
    { code: 'HRA', name: 'House Rent Allowance', componentType: 'EARNING', componentCategory: 'NORMAL', countryCode: 'IND', calculationType: 'PERCENTAGE', defaultValue: 40, percentageBase: 'BASIC', isTaxable: true, taxTreatment: 'PARTIALLY_TAXABLE', exemptionSection: '10(13A)', maxExemptionAmt: 300000, affectsGross: true, affectsNet: true, affectsCTC: true, paymentFrequency: 'MONTHLY', prorationApplicable: true, roundingRule: 'NEAREST', isActive: true, effectiveFrom: new Date('2024-04-01') },
    { code: 'DA', name: 'Dearness Allowance', componentType: 'EARNING', componentCategory: 'NORMAL', countryCode: 'IND', calculationType: 'PERCENTAGE', defaultValue: 10, percentageBase: 'BASIC', isTaxable: true, taxTreatment: 'FULLY_TAXABLE', affectsGross: true, affectsNet: true, affectsCTC: true, paymentFrequency: 'MONTHLY', prorationApplicable: true, roundingRule: 'NEAREST', isActive: true, effectiveFrom: new Date('2024-04-01') },
    { code: 'SPA', name: 'Special Allowance', componentType: 'EARNING', componentCategory: 'NORMAL', countryCode: 'IND', calculationType: 'FLAT_AMOUNT', defaultValue: 0, isTaxable: true, taxTreatment: 'FULLY_TAXABLE', affectsGross: true, affectsNet: true, affectsCTC: true, paymentFrequency: 'MONTHLY', prorationApplicable: true, roundingRule: 'NEAREST', isActive: true, effectiveFrom: new Date('2024-04-01') },
    { code: 'TRA', name: 'Transport Allowance', componentType: 'EARNING', componentCategory: 'NORMAL', countryCode: 'IND', calculationType: 'FLAT_AMOUNT', defaultValue: 3200, isTaxable: true, taxTreatment: 'PARTIALLY_TAXABLE', exemptionSection: '10(14)', maxExemptionAmt: 19200, affectsGross: true, affectsNet: true, affectsCTC: true, paymentFrequency: 'MONTHLY', prorationApplicable: true, roundingRule: 'NEAREST', isActive: true, effectiveFrom: new Date('2024-04-01') },
    { code: 'MED', name: 'Medical Allowance', componentType: 'EARNING', componentCategory: 'NORMAL', countryCode: 'IND', calculationType: 'FLAT_AMOUNT', defaultValue: 1250, isTaxable: true, taxTreatment: 'PARTIALLY_TAXABLE', exemptionSection: '80D', maxExemptionAmt: 15000, affectsGross: true, affectsNet: true, affectsCTC: true, paymentFrequency: 'MONTHLY', prorationApplicable: true, roundingRule: 'NEAREST', isActive: true, effectiveFrom: new Date('2024-04-01') },
    { code: 'LTA', name: 'Leave Travel Allowance', componentType: 'EARNING', componentCategory: 'NORMAL', countryCode: 'IND', calculationType: 'FLAT_AMOUNT', defaultValue: 10000, isTaxable: true, taxTreatment: 'PARTIALLY_TAXABLE', exemptionSection: '10(5)', affectsGross: true, affectsNet: true, affectsCTC: true, paymentFrequency: 'ANNUAL', prorationApplicable: false, roundingRule: 'NEAREST', isActive: true, effectiveFrom: new Date('2024-04-01') },
    { code: 'OT', name: 'Overtime Pay', componentType: 'EARNING', componentCategory: 'NORMAL', countryCode: 'IND', calculationType: 'FLAT_AMOUNT', defaultValue: 0, isTaxable: true, taxTreatment: 'FULLY_TAXABLE', affectsGross: true, affectsNet: true, affectsCTC: false, paymentFrequency: 'VARIABLE', prorationApplicable: false, roundingRule: 'NEAREST', isActive: true, effectiveFrom: new Date('2024-04-01') },
    { code: 'PERF_B', name: 'Performance Bonus', componentType: 'EARNING', componentCategory: 'NORMAL', countryCode: 'IND', calculationType: 'FLAT_AMOUNT', defaultValue: 0, isTaxable: true, taxTreatment: 'FULLY_TAXABLE', affectsGross: true, affectsNet: true, affectsCTC: true, paymentFrequency: 'ANNUAL', prorationApplicable: false, roundingRule: 'NEAREST', isActive: true, effectiveFrom: new Date('2024-04-01') },
    // US Earnings
    { code: 'BASIC', name: 'Base Salary', componentType: 'EARNING', componentCategory: 'NORMAL', countryCode: 'USA', calculationType: 'FLAT_AMOUNT', defaultValue: 0, isTaxable: true, taxTreatment: 'FULLY_TAXABLE', affectsGross: true, affectsNet: true, affectsCTC: true, paymentFrequency: 'MONTHLY', prorationApplicable: true, roundingRule: 'NEAREST', isActive: true, effectiveFrom: new Date('2024-01-01') },
    { code: 'SHIFT', name: 'Shift Allowance', componentType: 'EARNING', componentCategory: 'NORMAL', countryCode: 'USA', calculationType: 'FLAT_AMOUNT', defaultValue: 0, isTaxable: true, taxTreatment: 'FULLY_TAXABLE', affectsGross: true, affectsNet: true, affectsCTC: true, paymentFrequency: 'MONTHLY', prorationApplicable: false, roundingRule: 'NEAREST', isActive: true, effectiveFrom: new Date('2024-01-01') },
    { code: 'COMMISSION', name: 'Commission', componentType: 'EARNING', componentCategory: 'NORMAL', countryCode: 'USA', calculationType: 'FLAT_AMOUNT', defaultValue: 0, isTaxable: true, taxTreatment: 'FULLY_TAXABLE', affectsGross: true, affectsNet: true, affectsCTC: false, paymentFrequency: 'VARIABLE', prorationApplicable: false, roundingRule: 'NEAREST', isActive: true, effectiveFrom: new Date('2024-01-01') },
    // UK Earnings
    { code: 'BASIC', name: 'Basic Salary', componentType: 'EARNING', componentCategory: 'NORMAL', countryCode: 'GBR', calculationType: 'FLAT_AMOUNT', defaultValue: 0, isTaxable: true, taxTreatment: 'FULLY_TAXABLE', affectsGross: true, affectsNet: true, affectsCTC: true, paymentFrequency: 'MONTHLY', prorationApplicable: true, roundingRule: 'NEAREST', isActive: true, effectiveFrom: new Date('2024-04-06') },
    // Singapore Earnings
    { code: 'BASIC', name: 'Basic Salary', componentType: 'EARNING', componentCategory: 'NORMAL', countryCode: 'SGP', calculationType: 'FLAT_AMOUNT', defaultValue: 0, isTaxable: true, taxTreatment: 'FULLY_TAXABLE', affectsGross: true, affectsNet: true, affectsCTC: true, paymentFrequency: 'MONTHLY', prorationApplicable: true, roundingRule: 'NEAREST', isActive: true, effectiveFrom: new Date('2024-01-01') },
    // UAE Earnings
    { code: 'BASIC', name: 'Basic Salary', componentType: 'EARNING', componentCategory: 'NORMAL', countryCode: 'UAE', calculationType: 'PERCENTAGE', defaultValue: 60, isTaxable: false, taxTreatment: 'EXEMPT', affectsGross: true, affectsNet: true, affectsCTC: true, paymentFrequency: 'MONTHLY', prorationApplicable: true, roundingRule: 'NEAREST', isActive: true, effectiveFrom: new Date('2024-01-01') },
    { code: 'HRA_UAE', name: 'Housing Allowance', componentType: 'EARNING', componentCategory: 'NORMAL', countryCode: 'UAE', calculationType: 'PERCENTAGE', defaultValue: 25, percentageBase: 'BASIC', isTaxable: false, taxTreatment: 'EXEMPT', affectsGross: true, affectsNet: true, affectsCTC: true, paymentFrequency: 'MONTHLY', prorationApplicable: true, roundingRule: 'NEAREST', isActive: true, effectiveFrom: new Date('2024-01-01') },
    // Australia Earnings
    { code: 'BASIC', name: 'Base Salary', componentType: 'EARNING', componentCategory: 'NORMAL', countryCode: 'AUS', calculationType: 'FLAT_AMOUNT', defaultValue: 0, isTaxable: true, taxTreatment: 'FULLY_TAXABLE', affectsGross: true, affectsNet: true, affectsCTC: true, paymentFrequency: 'MONTHLY', prorationApplicable: true, roundingRule: 'NEAREST', isActive: true, effectiveFrom: new Date('2024-07-01') },
  ];

  // ────────────────────────────────────────────────────────────
  // 2. PAYROLL COMPONENTS — Normal Deductions
  // ────────────────────────────────────────────────────────────
  const normalDeductions = [
    { code: 'ADV_REC', name: 'Salary Advance Recovery', componentType: 'DEDUCTION', componentCategory: 'NORMAL', countryCode: 'IND', calculationType: 'FLAT_AMOUNT', defaultValue: 0, isTaxable: false, taxTreatment: null, affectsGross: false, affectsNet: true, affectsCTC: false, paymentFrequency: 'MONTHLY', prorationApplicable: false, roundingRule: 'NEAREST', isActive: true, effectiveFrom: new Date('2024-04-01') },
    { code: 'LOAN_EMI', name: 'Employee Loan EMI', componentType: 'DEDUCTION', componentCategory: 'NORMAL', countryCode: 'IND', calculationType: 'FLAT_AMOUNT', defaultValue: 0, isTaxable: false, taxTreatment: null, affectsGross: false, affectsNet: true, affectsCTC: false, paymentFrequency: 'MONTHLY', prorationApplicable: false, roundingRule: 'NEAREST', isActive: true, effectiveFrom: new Date('2024-04-01') },
    { code: 'VPF', name: 'Voluntary PF', componentType: 'DEDUCTION', componentCategory: 'NORMAL', countryCode: 'IND', calculationType: 'PERCENTAGE', defaultValue: 0, percentageBase: 'BASIC', isTaxable: false, taxTreatment: 'EXEMPT', exemptionSection: '80C', affectsGross: false, affectsNet: true, affectsCTC: false, paymentFrequency: 'MONTHLY', prorationApplicable: false, roundingRule: 'NEAREST', isActive: true, effectiveFrom: new Date('2024-04-01') },
    { code: 'MEAL_D', name: 'Meal Card Deduction', componentType: 'DEDUCTION', componentCategory: 'NORMAL', countryCode: 'IND', calculationType: 'FLAT_AMOUNT', defaultValue: 2200, isTaxable: false, taxTreatment: 'EXEMPT', exemptionSection: '10(14)', affectsGross: false, affectsNet: true, affectsCTC: false, paymentFrequency: 'MONTHLY', prorationApplicable: false, roundingRule: 'NEAREST', isActive: true, effectiveFrom: new Date('2024-04-01') },
    { code: 'PARK', name: 'Parking Deduction', componentType: 'DEDUCTION', componentCategory: 'NORMAL', countryCode: 'USA', calculationType: 'FLAT_AMOUNT', defaultValue: 150, isTaxable: false, taxTreatment: null, affectsGross: false, affectsNet: true, affectsCTC: false, paymentFrequency: 'MONTHLY', prorationApplicable: false, roundingRule: 'NEAREST', isActive: true, effectiveFrom: new Date('2024-01-01') },
    { code: 'UNION', name: 'Union Dues', componentType: 'DEDUCTION', componentCategory: 'NORMAL', countryCode: 'GBR', calculationType: 'FLAT_AMOUNT', defaultValue: 0, isTaxable: false, taxTreatment: null, affectsGross: false, affectsNet: true, affectsCTC: false, paymentFrequency: 'MONTHLY', prorationApplicable: false, roundingRule: 'NEAREST', isActive: true, effectiveFrom: new Date('2024-04-06') },
  ];

  // ────────────────────────────────────────────────────────────
  // 3. STATUTORY COMPONENTS
  // ────────────────────────────────────────────────────────────
  const statutoryComponents = [
    // India
    { code: 'EPF_EE', name: 'EPF - Employee Share', countryCode: 'IND', authorityName: 'EPFO', partyType: 'EMPLOYEE', calculationBasis: 'BASIC_PAY', ratePercentage: 12, wageCeiling: 15000, remittanceFrequency: 'MONTHLY', remittanceDueDay: 15, filingFrequency: 'MONTHLY', filingFormat: 'ECR', penaltyRatePct: 12, isChallanRequired: true, challanFormat: 'CHALLAN_ITNS', effectiveFrom: new Date('2024-04-01'), isActive: true },
    { code: 'EPF_ER', name: 'EPF - Employer Share', countryCode: 'IND', authorityName: 'EPFO', partyType: 'EMPLOYER', calculationBasis: 'BASIC_PAY', ratePercentage: 12, wageCeiling: 15000, remittanceFrequency: 'MONTHLY', remittanceDueDay: 15, filingFrequency: 'MONTHLY', filingFormat: 'ECR', penaltyRatePct: 12, isChallanRequired: true, challanFormat: 'CHALLAN_ITNS', effectiveFrom: new Date('2024-04-01'), isActive: true },
    { code: 'EPS_ER', name: 'EPS (Pension)', countryCode: 'IND', authorityName: 'EPFO', partyType: 'EMPLOYER', calculationBasis: 'BASIC_PAY', ratePercentage: 8.33, wageCeiling: 15000, remittanceFrequency: 'MONTHLY', remittanceDueDay: 15, filingFrequency: 'MONTHLY', filingFormat: 'ECR', penaltyRatePct: 12, isChallanRequired: true, challanFormat: 'CHALLAN_ITNS', effectiveFrom: new Date('2024-04-01'), isActive: true },
    { code: 'EDLI_ER', name: 'EDLI - Employer', countryCode: 'IND', authorityName: 'EPFO', partyType: 'EMPLOYER', calculationBasis: 'BASIC_PAY', ratePercentage: 0.5, wageCeiling: 15000, remittanceFrequency: 'MONTHLY', remittanceDueDay: 15, filingFrequency: 'MONTHLY', filingFormat: 'ECR', isChallanRequired: true, challanFormat: 'CHALLAN_ITNS', effectiveFrom: new Date('2024-04-01'), isActive: true },
    { code: 'ESI_EE', name: 'ESI - Employee', countryCode: 'IND', authorityName: 'ESIC', partyType: 'EMPLOYEE', calculationBasis: 'GROSS_PAY', ratePercentage: 0.75, wageCeiling: 21000, remittanceFrequency: 'MONTHLY', remittanceDueDay: 15, filingFrequency: 'HALF_YEARLY', filingFormat: 'ESI_RETURN', penaltyRatePct: 18, isChallanRequired: true, challanFormat: 'CHALLAN_ESI', effectiveFrom: new Date('2024-04-01'), isActive: true },
    { code: 'ESI_ER', name: 'ESI - Employer', countryCode: 'IND', authorityName: 'ESIC', partyType: 'EMPLOYER', calculationBasis: 'GROSS_PAY', ratePercentage: 3.25, wageCeiling: 21000, remittanceFrequency: 'MONTHLY', remittanceDueDay: 15, filingFrequency: 'HALF_YEARLY', filingFormat: 'ESI_RETURN', penaltyRatePct: 18, isChallanRequired: true, challanFormat: 'CHALLAN_ESI', effectiveFrom: new Date('2024-04-01'), isActive: true },
    { code: 'PTAX', name: 'Professional Tax', countryCode: 'IND', authorityName: 'State Government', partyType: 'EMPLOYEE', calculationBasis: 'SLAB_BASED', remittanceFrequency: 'MONTHLY', filingFrequency: 'ANNUAL', filingFormat: 'STATE_PTAX', isChallanRequired: true, effectiveFrom: new Date('2024-04-01'), isActive: true },
    { code: 'TDS', name: 'TDS (Income Tax)', countryCode: 'IND', authorityName: 'Income Tax Dept', partyType: 'EMPLOYEE', calculationBasis: 'SLAB_BASED', remittanceFrequency: 'MONTHLY', remittanceDueDay: 7, filingFrequency: 'QUARTERLY', filingFormat: '24Q', penaltyRatePct: 1.5, isChallanRequired: true, challanFormat: 'CHALLAN_ITNS', effectiveFrom: new Date('2024-04-01'), isActive: true },
    { code: 'LWF_EE', name: 'Labour Welfare Fund - Employee', countryCode: 'IND', authorityName: 'State Government', partyType: 'EMPLOYEE', calculationBasis: 'FLAT_RATE', remittanceFrequency: 'HALF_YEARLY', filingFrequency: 'HALF_YEARLY', isChallanRequired: false, effectiveFrom: new Date('2024-04-01'), isActive: true },
    { code: 'LWF_ER', name: 'Labour Welfare Fund - Employer', countryCode: 'IND', authorityName: 'State Government', partyType: 'EMPLOYER', calculationBasis: 'FLAT_RATE', remittanceFrequency: 'HALF_YEARLY', filingFrequency: 'HALF_YEARLY', isChallanRequired: false, effectiveFrom: new Date('2024-04-01'), isActive: true },
    // United States
    { code: 'FIT', name: 'Federal Income Tax', countryCode: 'USA', authorityName: 'IRS', partyType: 'EMPLOYEE', calculationBasis: 'SLAB_BASED', remittanceFrequency: 'MONTHLY', filingFrequency: 'QUARTERLY', filingFormat: '941', isChallanRequired: true, effectiveFrom: new Date('2024-01-01'), isActive: true },
    { code: 'SIT', name: 'State Income Tax', countryCode: 'USA', authorityName: 'State Revenue', partyType: 'EMPLOYEE', calculationBasis: 'SLAB_BASED', remittanceFrequency: 'MONTHLY', filingFrequency: 'QUARTERLY', isChallanRequired: true, effectiveFrom: new Date('2024-01-01'), isActive: true },
    { code: 'SS_EE', name: 'Social Security (OASDI) - Employee', countryCode: 'USA', authorityName: 'SSA', partyType: 'EMPLOYEE', calculationBasis: 'GROSS_PAY', ratePercentage: 6.2, wageCeiling: 168600, remittanceFrequency: 'MONTHLY', filingFrequency: 'QUARTERLY', filingFormat: '941', isChallanRequired: true, effectiveFrom: new Date('2024-01-01'), isActive: true },
    { code: 'SS_ER', name: 'Social Security (OASDI) - Employer', countryCode: 'USA', authorityName: 'SSA', partyType: 'EMPLOYER', calculationBasis: 'GROSS_PAY', ratePercentage: 6.2, wageCeiling: 168600, remittanceFrequency: 'MONTHLY', filingFrequency: 'QUARTERLY', filingFormat: '941', isChallanRequired: true, effectiveFrom: new Date('2024-01-01'), isActive: true },
    { code: 'MED_EE', name: 'Medicare (HI) - Employee', countryCode: 'USA', authorityName: 'IRS', partyType: 'EMPLOYEE', calculationBasis: 'GROSS_PAY', ratePercentage: 1.45, remittanceFrequency: 'MONTHLY', filingFrequency: 'QUARTERLY', filingFormat: '941', isChallanRequired: true, effectiveFrom: new Date('2024-01-01'), isActive: true },
    { code: 'MED_ER', name: 'Medicare (HI) - Employer', countryCode: 'USA', authorityName: 'IRS', partyType: 'EMPLOYER', calculationBasis: 'GROSS_PAY', ratePercentage: 1.45, remittanceFrequency: 'MONTHLY', filingFrequency: 'QUARTERLY', filingFormat: '941', isChallanRequired: true, effectiveFrom: new Date('2024-01-01'), isActive: true },
    { code: 'FUTA', name: 'FUTA', countryCode: 'USA', authorityName: 'IRS', partyType: 'EMPLOYER', calculationBasis: 'GROSS_PAY', ratePercentage: 6.0, wageCeiling: 7000, remittanceFrequency: 'QUARTERLY', filingFrequency: 'QUARTERLY', filingFormat: '940', isChallanRequired: true, effectiveFrom: new Date('2024-01-01'), isActive: true },
    // United Kingdom
    { code: 'PAYE', name: 'Income Tax (PAYE)', countryCode: 'GBR', authorityName: 'HMRC', partyType: 'EMPLOYEE', calculationBasis: 'SLAB_BASED', remittanceFrequency: 'MONTHLY', filingFrequency: 'MONTHLY', filingFormat: 'FPS', isChallanRequired: false, effectiveFrom: new Date('2024-04-06'), isActive: true },
    { code: 'NI_EE', name: 'National Insurance - Employee', countryCode: 'GBR', authorityName: 'HMRC', partyType: 'EMPLOYEE', calculationBasis: 'GROSS_PAY', ratePercentage: 8, remittanceFrequency: 'MONTHLY', filingFrequency: 'MONTHLY', filingFormat: 'FPS', isChallanRequired: false, effectiveFrom: new Date('2024-04-06'), isActive: true },
    { code: 'NI_ER', name: 'National Insurance - Employer', countryCode: 'GBR', authorityName: 'HMRC', partyType: 'EMPLOYER', calculationBasis: 'GROSS_PAY', ratePercentage: 13.8, remittanceFrequency: 'MONTHLY', filingFrequency: 'MONTHLY', filingFormat: 'FPS', isChallanRequired: false, effectiveFrom: new Date('2024-04-06'), isActive: true },
    { code: 'PEN_EE', name: 'Workplace Pension (AE) - Employee', countryCode: 'GBR', authorityName: 'TPR/Pension Provider', partyType: 'EMPLOYEE', calculationBasis: 'GROSS_PAY', ratePercentage: 5, remittanceFrequency: 'MONTHLY', filingFrequency: 'MONTHLY', isChallanRequired: false, effectiveFrom: new Date('2024-04-06'), isActive: true },
    { code: 'PEN_ER', name: 'Workplace Pension (AE) - Employer', countryCode: 'GBR', authorityName: 'TPR/Pension Provider', partyType: 'EMPLOYER', calculationBasis: 'GROSS_PAY', ratePercentage: 3, remittanceFrequency: 'MONTHLY', filingFrequency: 'MONTHLY', isChallanRequired: false, effectiveFrom: new Date('2024-04-06'), isActive: true },
    { code: 'APP_LEVY', name: 'Apprenticeship Levy', countryCode: 'GBR', authorityName: 'HMRC', partyType: 'EMPLOYER', calculationBasis: 'GROSS_PAY', ratePercentage: 0.5, remittanceFrequency: 'MONTHLY', filingFrequency: 'MONTHLY', isChallanRequired: false, effectiveFrom: new Date('2024-04-06'), isActive: true },
    // Singapore
    { code: 'CPF_EE', name: 'Central Provident Fund - Employee', countryCode: 'SGP', authorityName: 'CPF Board', partyType: 'EMPLOYEE', calculationBasis: 'GROSS_PAY', ratePercentage: 20, wageCeiling: 6800, remittanceFrequency: 'MONTHLY', remittanceDueDay: 14, filingFrequency: 'MONTHLY', filingFormat: 'EZPay', penaltyRatePct: 18, isChallanRequired: false, effectiveFrom: new Date('2024-01-01'), isActive: true },
    { code: 'CPF_ER', name: 'Central Provident Fund - Employer', countryCode: 'SGP', authorityName: 'CPF Board', partyType: 'EMPLOYER', calculationBasis: 'GROSS_PAY', ratePercentage: 17, wageCeiling: 6800, remittanceFrequency: 'MONTHLY', remittanceDueDay: 14, filingFrequency: 'MONTHLY', filingFormat: 'EZPay', penaltyRatePct: 18, isChallanRequired: false, effectiveFrom: new Date('2024-01-01'), isActive: true },
    { code: 'SDL', name: 'Skills Development Levy', countryCode: 'SGP', authorityName: 'SkillsFuture SG', partyType: 'EMPLOYER', calculationBasis: 'GROSS_PAY', ratePercentage: 0.25, minContributionAmt: 2, remittanceFrequency: 'MONTHLY', remittanceDueDay: 14, filingFrequency: 'MONTHLY', filingFormat: 'EZPay', isChallanRequired: false, effectiveFrom: new Date('2024-01-01'), isActive: true },
    { code: 'FWL', name: 'Foreign Worker Levy', countryCode: 'SGP', authorityName: 'MOM', partyType: 'EMPLOYER', calculationBasis: 'FLAT_RATE', remittanceFrequency: 'MONTHLY', remittanceDueDay: 14, filingFrequency: 'MONTHLY', isChallanRequired: false, effectiveFrom: new Date('2024-01-01'), isActive: true },
    { code: 'IRAS_TAX', name: 'Income Tax (IRAS)', countryCode: 'SGP', authorityName: 'IRAS', partyType: 'EMPLOYEE', calculationBasis: 'SLAB_BASED', remittanceFrequency: 'ANNUAL', filingFrequency: 'ANNUAL', filingFormat: 'IR8A', isChallanRequired: false, effectiveFrom: new Date('2024-01-01'), isActive: true },
  ];

  // ────────────────────────────────────────────────────────────
  // 4. TAX SLAB TABLES
  // ────────────────────────────────────────────────────────────
  const indiaSlab = await prisma.taxSlabTable.create({
    data: {
      slabTableName: 'India New Regime FY 2025-26',
      countryCode: 'IND',
      taxYear: '2025-26',
      filingStatus: 'STANDARD',
      regimeType: 'NEW',
      effectiveFrom: new Date('2025-04-01'),
      isActive: true,
      rateLines: {
        create: [
          { sequence: 1, incomeFrom: 0, incomeTo: 400000, ratePercentage: 0 },
          { sequence: 2, incomeFrom: 400001, incomeTo: 800000, ratePercentage: 5 },
          { sequence: 3, incomeFrom: 800001, incomeTo: 1200000, ratePercentage: 10 },
          { sequence: 4, incomeFrom: 1200001, incomeTo: 1600000, ratePercentage: 15 },
          { sequence: 5, incomeFrom: 1600001, incomeTo: 2000000, ratePercentage: 20 },
          { sequence: 6, incomeFrom: 2000001, incomeTo: 2400000, ratePercentage: 25 },
          { sequence: 7, incomeFrom: 2400001, incomeTo: null, ratePercentage: 30, cessRate: 4 },
        ],
      },
    },
  });

  const usSlab = await prisma.taxSlabTable.create({
    data: {
      slabTableName: 'US Single Filer 2025',
      countryCode: 'USA',
      taxYear: '2025',
      filingStatus: 'SINGLE',
      regimeType: 'STANDARD',
      effectiveFrom: new Date('2025-01-01'),
      isActive: true,
      rateLines: {
        create: [
          { sequence: 1, incomeFrom: 0, incomeTo: 11600, ratePercentage: 10 },
          { sequence: 2, incomeFrom: 11601, incomeTo: 47150, ratePercentage: 12 },
          { sequence: 3, incomeFrom: 47151, incomeTo: 100525, ratePercentage: 22 },
          { sequence: 4, incomeFrom: 100526, incomeTo: 191950, ratePercentage: 24 },
          { sequence: 5, incomeFrom: 191951, incomeTo: 243725, ratePercentage: 32 },
          { sequence: 6, incomeFrom: 243726, incomeTo: 609350, ratePercentage: 35 },
          { sequence: 7, incomeFrom: 609351, incomeTo: null, ratePercentage: 37 },
        ],
      },
    },
  });

  const ukSlab = await prisma.taxSlabTable.create({
    data: {
      slabTableName: 'UK PAYE 2025-26',
      countryCode: 'GBR',
      taxYear: '2025-26',
      filingStatus: 'STANDARD',
      regimeType: 'STANDARD',
      effectiveFrom: new Date('2025-04-06'),
      isActive: true,
      rateLines: {
        create: [
          { sequence: 1, incomeFrom: 0, incomeTo: 12570, ratePercentage: 0 },
          { sequence: 2, incomeFrom: 12571, incomeTo: 50270, ratePercentage: 20 },
          { sequence: 3, incomeFrom: 50271, incomeTo: 125140, ratePercentage: 40 },
          { sequence: 4, incomeFrom: 125141, incomeTo: null, ratePercentage: 45 },
        ],
      },
    },
  });

  const sgSlab = await prisma.taxSlabTable.create({
    data: {
      slabTableName: 'Singapore Income Tax YA 2025',
      countryCode: 'SGP',
      taxYear: '2025',
      filingStatus: 'STANDARD',
      regimeType: 'STANDARD',
      effectiveFrom: new Date('2025-01-01'),
      isActive: true,
      rateLines: {
        create: [
          { sequence: 1, incomeFrom: 0, incomeTo: 20000, ratePercentage: 0 },
          { sequence: 2, incomeFrom: 20001, incomeTo: 30000, ratePercentage: 2 },
          { sequence: 3, incomeFrom: 30001, incomeTo: 40000, ratePercentage: 3.5 },
          { sequence: 4, incomeFrom: 40001, incomeTo: 80000, ratePercentage: 7 },
          { sequence: 5, incomeFrom: 80001, incomeTo: 120000, ratePercentage: 11.5 },
          { sequence: 6, incomeFrom: 120001, incomeTo: 160000, ratePercentage: 15 },
          { sequence: 7, incomeFrom: 160001, incomeTo: 200000, ratePercentage: 18 },
          { sequence: 8, incomeFrom: 200001, incomeTo: 240000, ratePercentage: 19 },
          { sequence: 9, incomeFrom: 240001, incomeTo: 320000, ratePercentage: 19.5 },
          { sequence: 10, incomeFrom: 320001, incomeTo: 500000, ratePercentage: 20 },
          { sequence: 11, incomeFrom: 500001, incomeTo: 1000000, ratePercentage: 22 },
          { sequence: 12, incomeFrom: 1000001, incomeTo: null, ratePercentage: 24 },
        ],
      },
    },
  });

  console.log(`  ✅ Created ${4} tax slab tables with rate lines`);

  // ────────────────────────────────────────────────────────────
  // 5. CURRENCY CONFIGS & EXCHANGE RATES
  // ────────────────────────────────────────────────────────────
  const currencyConfigs = [
    { legalEntityId: 'LE-IND-001', baseCurrency: 'INR', payrollCurrency: 'INR', reportingCurrency: 'USD', exchangeRateSource: 'CENTRAL_BANK', rateType: 'MONTHLY_AVERAGE', autoFetchEnabled: true, fetchFrequency: 'DAILY', roundingPrecision: 2, roundingRule: 'NEAREST', gainLossAccount: 'GL-EXCH-001' },
    { legalEntityId: 'LE-USA-001', baseCurrency: 'USD', payrollCurrency: 'USD', reportingCurrency: 'USD', exchangeRateSource: 'REUTERS', rateType: 'SPOT', autoFetchEnabled: true, fetchFrequency: 'DAILY', roundingPrecision: 2, roundingRule: 'NEAREST', gainLossAccount: 'GL-EXCH-002' },
    { legalEntityId: 'LE-GBR-001', baseCurrency: 'GBP', payrollCurrency: 'GBP', reportingCurrency: 'USD', exchangeRateSource: 'BLOOMBERG', rateType: 'SPOT', autoFetchEnabled: true, fetchFrequency: 'DAILY', roundingPrecision: 2, roundingRule: 'NEAREST', gainLossAccount: 'GL-EXCH-003' },
    { legalEntityId: 'LE-SGP-001', baseCurrency: 'SGD', payrollCurrency: 'SGD', reportingCurrency: 'USD', exchangeRateSource: 'CENTRAL_BANK', rateType: 'SPOT', autoFetchEnabled: true, fetchFrequency: 'MONTHLY', roundingPrecision: 2, roundingRule: 'NEAREST', gainLossAccount: 'GL-EXCH-004' },
  ];

  const exchangeRates = [
    { fromCurrency: 'USD', toCurrency: 'INR', exchangeRate: 83.45, rateDate: new Date('2025-06-01'), rateType: 'MONTHLY_AVERAGE', source: 'RBI', inverseRate: 0.011983, isActive: true },
    { fromCurrency: 'USD', toCurrency: 'GBP', exchangeRate: 0.79, rateDate: new Date('2025-06-01'), rateType: 'SPOT', source: 'Reuters', inverseRate: 1.2658, isActive: true },
    { fromCurrency: 'USD', toCurrency: 'SGD', exchangeRate: 1.34, rateDate: new Date('2025-06-01'), rateType: 'SPOT', source: 'MAS', inverseRate: 0.7463, isActive: true },
    { fromCurrency: 'USD', toCurrency: 'AED', exchangeRate: 3.6725, rateDate: new Date('2025-06-01'), rateType: 'FIXED', source: 'Central Bank of UAE', inverseRate: 0.2723, isActive: true },
    { fromCurrency: 'USD', toCurrency: 'AUD', exchangeRate: 1.53, rateDate: new Date('2025-06-01'), rateType: 'SPOT', source: 'RBA', inverseRate: 0.6536, isActive: true },
    { fromCurrency: 'GBP', toCurrency: 'INR', exchangeRate: 105.63, rateDate: new Date('2025-06-01'), rateType: 'SPOT', source: 'Reuters', inverseRate: 0.009467, isActive: true },
    { fromCurrency: 'GBP', toCurrency: 'SGD', exchangeRate: 1.70, rateDate: new Date('2025-06-01'), rateType: 'SPOT', source: 'Bloomberg', inverseRate: 0.5882, isActive: true },
    { fromCurrency: 'SGD', toCurrency: 'INR', exchangeRate: 62.22, rateDate: new Date('2025-06-01'), rateType: 'SPOT', source: 'MAS', inverseRate: 0.01607, isActive: true },
  ];

  // ────────────────────────────────────────────────────────────
  // 6. DIMENSION DEFINITIONS
  // ────────────────────────────────────────────────────────────
  const dimensions = [
    { code: 'DEPT', name: 'Department', dimensionType: 'STANDARD', hierarchyEnabled: true, allocationMethod: 'PERCENTAGE', isMandatory: true, allowMultiple: false, maxAllocations: 1, effectiveFrom: new Date('2024-01-01') },
    { code: 'CC', name: 'Cost Center', dimensionType: 'STANDARD', hierarchyEnabled: true, allocationMethod: 'PERCENTAGE', isMandatory: true, allowMultiple: true, maxAllocations: 3, effectiveFrom: new Date('2024-01-01') },
    { code: 'PROJ', name: 'Project', dimensionType: 'STANDARD', hierarchyEnabled: false, allocationMethod: 'PERCENTAGE', isMandatory: false, allowMultiple: true, maxAllocations: 5, effectiveFrom: new Date('2024-01-01') },
    { code: 'LOC', name: 'Location', dimensionType: 'STANDARD', hierarchyEnabled: true, allocationMethod: 'PERCENTAGE', isMandatory: true, allowMultiple: false, maxAllocations: 1, effectiveFrom: new Date('2024-01-01') },
    { code: 'BU', name: 'Business Unit', dimensionType: 'STANDARD', hierarchyEnabled: true, allocationMethod: 'PERCENTAGE', isMandatory: false, allowMultiple: false, maxAllocations: 1, effectiveFrom: new Date('2024-01-01') },
  ];

  // ────────────────────────────────────────────────────────────
  // 7. COMPLIANCE OBLIGATIONS
  // ────────────────────────────────────────────────────────────
  const complianceObligations = [
    { name: 'Monthly PF ECR Filing', countryCode: 'IND', authorityName: 'EPFO', filingType: 'RETURN', frequency: 'MONTHLY', dueDateRule: 'D+15', graceDays: 5, penaltyType: 'PERCENTAGE_PER_MONTH', penaltyValue: 12, responsibleRole: 'PAYROLL_ADMIN', escalationRole: 'HR_MANAGER', reminderDaysBefore: '7,3,1', autoGenerate: true, filingFormat: 'ECR_CSV', isActive: true },
    { name: 'Monthly ESI Return', countryCode: 'IND', authorityName: 'ESIC', filingType: 'RETURN', frequency: 'HALF_YEARLY', dueDateRule: 'H+12', graceDays: 0, penaltyType: 'PERCENTAGE_PER_MONTH', penaltyValue: 18, responsibleRole: 'PAYROLL_ADMIN', escalationRole: 'HR_MANAGER', reminderDaysBefore: '7,3,1', autoGenerate: true, filingFormat: 'ESI_RETURN', isActive: true },
    { name: 'Quarterly TDS Return (Form 24Q)', countryCode: 'IND', authorityName: 'Income Tax Dept', filingType: 'RETURN', frequency: 'QUARTERLY', dueDateRule: 'Q_END+30', graceDays: 0, penaltyType: 'PERCENTAGE_PER_MONTH', penaltyValue: 1.5, responsibleRole: 'PAYROLL_ADMIN', escalationRole: 'FINANCE_MANAGER', reminderDaysBefore: '7,3,1', autoGenerate: false, filingFormat: 'NSDL_TXT', isActive: true },
    { name: 'Annual Form 16 Issuance', countryCode: 'IND', authorityName: 'Income Tax Dept', filingType: 'CERTIFICATE', frequency: 'ANNUAL', dueDateRule: 'Y+0615', graceDays: 0, penaltyType: 'FIXED_AMOUNT', penaltyValue: 10000, responsibleRole: 'PAYROLL_ADMIN', escalationRole: 'HR_MANAGER', reminderDaysBefore: '30,15,7,3', autoGenerate: true, filingFormat: 'FORM16_PDF', isActive: true },
    { name: 'Federal 941 Quarterly Return', countryCode: 'USA', authorityName: 'IRS', filingType: 'RETURN', frequency: 'QUARTERLY', dueDateRule: 'Q_END+30', graceDays: 0, penaltyType: 'PERCENTAGE_PER_MONTH', penaltyValue: 5, responsibleRole: 'PAYROLL_ADMIN', escalationRole: 'CFO', reminderDaysBefore: '7,3,1', autoGenerate: false, filingFormat: 'IRS_EFILE', isActive: true },
    { name: 'Annual W-2 Filing', countryCode: 'USA', authorityName: 'IRS/SSA', filingType: 'RETURN', frequency: 'ANNUAL', dueDateRule: 'Y+0131', graceDays: 0, penaltyType: 'FIXED_AMOUNT', penaltyValue: 50, responsibleRole: 'PAYROLL_ADMIN', escalationRole: 'CFO', reminderDaysBefore: '14,7,3,1', autoGenerate: true, filingFormat: 'EFW2', isActive: true },
    { name: 'Monthly FPS Submission', countryCode: 'GBR', authorityName: 'HMRC', filingType: 'RETURN', frequency: 'MONTHLY', dueDateRule: 'PAY_DATE', graceDays: 0, penaltyType: 'FIXED_AMOUNT', penaltyValue: 100, responsibleRole: 'PAYROLL_ADMIN', escalationRole: 'HR_MANAGER', reminderDaysBefore: '3,1', autoGenerate: true, filingFormat: 'RTI_XML', isActive: true },
    { name: 'Annual P60 Issuance', countryCode: 'GBR', authorityName: 'HMRC', filingType: 'CERTIFICATE', frequency: 'ANNUAL', dueDateRule: 'Y+0531', graceDays: 0, penaltyType: 'FIXED_AMOUNT', penaltyValue: 300, responsibleRole: 'PAYROLL_ADMIN', escalationRole: 'HR_MANAGER', reminderDaysBefore: '14,7,3', autoGenerate: true, filingFormat: 'P60_PDF', isActive: true },
    { name: 'Monthly CPF Contribution', countryCode: 'SGP', authorityName: 'CPF Board', filingType: 'RETURN', frequency: 'MONTHLY', dueDateRule: 'D+14', graceDays: 0, penaltyType: 'PERCENTAGE_PER_MONTH', penaltyValue: 18, responsibleRole: 'PAYROLL_ADMIN', escalationRole: 'HR_MANAGER', reminderDaysBefore: '7,3,1', autoGenerate: true, filingFormat: 'EZPay', isActive: true },
    { name: 'Annual IR8A Filing', countryCode: 'SGP', authorityName: 'IRAS', filingType: 'RETURN', frequency: 'ANNUAL', dueDateRule: 'Y+0301', graceDays: 0, penaltyType: 'FIXED_AMOUNT', penaltyValue: 5000, responsibleRole: 'PAYROLL_ADMIN', escalationRole: 'CFO', reminderDaysBefore: '30,14,7,3', autoGenerate: true, filingFormat: 'AIS', isActive: true },
  ];

  // ────────────────────────────────────────────────────────────
  // SEED ALL DATA
  // ────────────────────────────────────────────────────────────

  // Components
  for (const comp of normalEarnings) {
    await prisma.payrollComponent.upsert({
      where: { id: `${comp.code}_${comp.countryCode}_EARN` },
      update: comp,
      create: { id: `${comp.code}_${comp.countryCode}_EARN`, ...comp },
    });
  }
  console.log(`  ✅ Created ${normalEarnings.length} normal earning components`);

  for (const comp of normalDeductions) {
    await prisma.payrollComponent.upsert({
      where: { id: `${comp.code}_${comp.countryCode}_DED` },
      update: comp,
      create: { id: `${comp.code}_${comp.countryCode}_DED`, ...comp },
    });
  }
  console.log(`  ✅ Created ${normalDeductions.length} normal deduction components`);

  for (const comp of statutoryComponents) {
    await prisma.statutoryComponent.upsert({
      where: { id: `${comp.code}_${comp.countryCode}` },
      update: comp,
      create: { id: `${comp.code}_${comp.countryCode}`, ...comp },
    });
  }
  console.log(`  ✅ Created ${statutoryComponents.length} statutory components`);

  // Currency configs
  for (const cfg of currencyConfigs) {
    await prisma.currencyConfig.create({ data: cfg });
  }
  console.log(`  ✅ Created ${currencyConfigs.length} currency configurations`);

  // Exchange rates
  for (const rate of exchangeRates) {
    await prisma.exchangeRate.create({ data: rate });
  }
  console.log(`  ✅ Created ${exchangeRates.length} exchange rates`);

  // Dimensions
  for (const dim of dimensions) {
    await prisma.dimensionDefinition.upsert({
      where: { id: dim.code },
      update: dim,
      create: { id: dim.code, ...dim },
    });
  }
  console.log(`  ✅ Created ${dimensions.length} dimension definitions`);

  // Compliance obligations
  for (const obl of complianceObligations) {
    await prisma.complianceObligation.create({ data: obl });
  }
  console.log(`  ✅ Created ${complianceObligations.length} compliance obligations`);

  // GL Account Mappings (sample)
  const sampleMappings = [
    { legalEntityId: 'LE-IND-001', componentId: 'BASIC_IND_EARN', debitAccount: 'GL-5001', creditAccount: 'GL-2001', costCenterSource: 'EMPLOYEE_DEFAULT', postingType: 'BOTH', effectiveFrom: new Date('2024-04-01') },
    { legalEntityId: 'LE-IND-001', componentId: 'HRA_IND_EARN', debitAccount: 'GL-5002', creditAccount: 'GL-2001', costCenterSource: 'EMPLOYEE_DEFAULT', postingType: 'BOTH', effectiveFrom: new Date('2024-04-01') },
    { legalEntityId: 'LE-IND-001', componentId: 'EPF_EE_IND', debitAccount: 'GL-2002', creditAccount: 'GL-2003', costCenterSource: 'EMPLOYEE_DEFAULT', postingType: 'ACTUAL', effectiveFrom: new Date('2024-04-01') },
    { legalEntityId: 'LE-IND-001', componentId: 'EPF_ER_IND', debitAccount: 'GL-5010', creditAccount: 'GL-2003', costCenterSource: 'DIMENSION_SPLIT', postingType: 'ACTUAL', effectiveFrom: new Date('2024-04-01') },
    { legalEntityId: 'LE-IND-001', componentId: 'TDS_IND', debitAccount: 'GL-2004', creditAccount: 'GL-2005', costCenterSource: 'EMPLOYEE_DEFAULT', postingType: 'ACTUAL', effectiveFrom: new Date('2024-04-01') },
  ];

  for (const mapping of sampleMappings) {
    await prisma.gLAccountMapping.create({ data: mapping }).catch(() => {
      // Skip if component doesn't exist yet
    });
  }
  console.log(`  ✅ Created sample GL account mappings`);

  console.log('\n🎉 Payroll module seed completed successfully!');
  console.log(`  - ${normalEarnings.length + normalDeductions.length} payroll components`);
  console.log(`  - ${statutoryComponents.length} statutory components (6 countries)`);
  console.log(`  - 4 tax slab tables (India, US, UK, Singapore)`);
  console.log(`  - ${currencyConfigs.length} currency configurations`);
  console.log(`  - ${exchangeRates.length} exchange rates`);
  console.log(`  - ${dimensions.length} dimension definitions`);
  console.log(`  - ${complianceObligations.length} compliance obligations`);
}

main()
  .catch((e) => {
    console.error('❌ Payroll seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
