import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { getTokenFromHeaders, verifyToken } from '@/lib/auth';
import { NextRequest } from 'next/server';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

// ─── India Tax Slab Calculation ───
function calculateIndiaIncomeTax(annualTaxableIncome: number, regime: string = 'new'): number {
  if (regime === 'old') {
    if (annualTaxableIncome <= 250000) return 0;
    if (annualTaxableIncome <= 500000) return (annualTaxableIncome - 250000) * 0.05;
    if (annualTaxableIncome <= 1000000) return 12500 + (annualTaxableIncome - 500000) * 0.2;
    return 112500 + (annualTaxableIncome - 1000000) * 0.3;
  }

  // New regime FY 2024-25
  let tax = 0;
  const slabs = [
    { limit: 300000, rate: 0 },
    { limit: 700000, rate: 0.05 },
    { limit: 1000000, rate: 0.10 },
    { limit: 1200000, rate: 0.15 },
    { limit: 1500000, rate: 0.20 },
    { limit: Infinity, rate: 0.30 },
  ];

  let remaining = annualTaxableIncome;
  let prevLimit = 0;
  for (const slab of slabs) {
    if (remaining <= 0) break;
    const taxableInSlab = Math.min(remaining, slab.limit - prevLimit);
    tax += taxableInSlab * slab.rate;
    remaining -= taxableInSlab;
    prevLimit = slab.limit;
  }

  // Section 87A rebate: if income <= 7L, tax = 0 under new regime
  if (annualTaxableIncome <= 700000) tax = 0;

  // Health & Education Cess 4%
  tax = tax * 1.04;

  return Math.round(tax);
}

// ─── Standard India CTC Breakdown (with optional PF/ESI) ───
function calculateIndiaCTCBreakdown(ctcAnnual: number, options?: { includePF?: boolean; includeESI?: boolean }) {
  const includePF = options?.includePF !== false;
  const includeESI = options?.includeESI !== false;

  const basicAnnual = Math.round(ctcAnnual * 0.40);
  const basicMonthly = Math.round(basicAnnual / 12);

  const hraAnnual = Math.round(basicAnnual * 0.40);
  const hraMonthly = Math.round(hraAnnual / 12);

  const employerPFAnnual = includePF ? Math.round(basicAnnual * 0.12) : 0;
  const employerPFMonthly = Math.round(employerPFAnnual / 12);

  const gratuityAnnual = Math.round(basicAnnual * 0.0481);
  const gratuityMonthly = Math.round(gratuityAnnual / 12);

  const variablePayAnnual = Math.round(ctcAnnual * 0.10);
  const variablePayMonthly = Math.round(variablePayAnnual / 12);

  const ltaAnnual = Math.round(ctcAnnual * 0.0167);
  const ltaMonthly = Math.round(ltaAnnual / 12);

  const medicalAnnual = 15000;
  const medicalMonthly = 1250;

  const conveyanceAnnual = 19200;
  const conveyanceMonthly = 1600;

  // Iterate to solve ESI (which depends on gross)
  let employerESIAnnual = 0;
  let grossAnnual = 0;
  let esiApplicable = false;

  for (let i = 0; i < 3; i++) {
    const empContribs = employerPFAnnual + gratuityAnnual + employerESIAnnual;
    grossAnnual = ctcAnnual - empContribs;
    const grossMonthly = Math.round(grossAnnual / 12);
    esiApplicable = includeESI && grossMonthly <= 21000;
    employerESIAnnual = esiApplicable ? Math.round(grossAnnual * 0.0325) : 0;
  }

  // Final gross
  const employerContributionsTotal = employerPFAnnual + gratuityAnnual + employerESIAnnual;
  grossAnnual = ctcAnnual - employerContributionsTotal;
  const specialAllowanceAnnual = Math.max(0, grossAnnual - (basicAnnual + hraAnnual + ltaAnnual + variablePayAnnual + medicalAnnual + conveyanceAnnual));
  const specialAllowanceMonthly = Math.round(specialAllowanceAnnual / 12);

  // Employee Deductions
  const employeePFAnnual = includePF ? employerPFAnnual : 0;
  const employeePFMonthly = Math.round(employeePFAnnual / 12);

  const professionalTaxAnnual = 2400;
  const professionalTaxMonthly = 200;

  const employeeESIAnnual = esiApplicable ? Math.round(grossAnnual * 0.0075) : 0;
  const employeeESIMonthly = Math.round(employeeESIAnnual / 12);

  const standardDeduction = 50000;
  const taxableIncome = Math.max(0, grossAnnual - employeePFAnnual - employeeESIAnnual - professionalTaxAnnual - standardDeduction);
  const tdsAnnual = calculateIndiaIncomeTax(taxableIncome, 'new');
  const tdsMonthly = Math.round(tdsAnnual / 12);

  const totalDeductionsAnnual = employeePFAnnual + employeeESIAnnual + professionalTaxAnnual + tdsAnnual;
  const totalDeductionsMonthly = employeePFMonthly + employeeESIMonthly + professionalTaxMonthly + tdsMonthly;

  const netAnnual = grossAnnual - totalDeductionsAnnual;
  const netMonthly = Math.round(netAnnual / 12);

  // Build employer contributions
  const employerContribsObj: Record<string, { annual: number; monthly: number; pctOfCTC: string }> = {
    employerPF: { annual: employerPFAnnual, monthly: employerPFMonthly, pctOfCTC: ((employerPFAnnual / ctcAnnual) * 100).toFixed(1) },
    gratuity: { annual: gratuityAnnual, monthly: gratuityMonthly, pctOfCTC: ((gratuityAnnual / ctcAnnual) * 100).toFixed(1) },
  };
  if (esiApplicable) {
    employerContribsObj.employerESI = { annual: employerESIAnnual, monthly: Math.round(employerESIAnnual / 12), pctOfCTC: ((employerESIAnnual / ctcAnnual) * 100).toFixed(1) };
  }

  // Build deductions
  const deductionsObj: Record<string, { annual: number; monthly: number; pctOfGross: string; taxableIncome?: number }> = {};
  if (includePF) {
    deductionsObj.employeePF = { annual: employeePFAnnual, monthly: employeePFMonthly, pctOfGross: ((employeePFAnnual / grossAnnual) * 100).toFixed(1) };
  }
  if (esiApplicable) {
    deductionsObj.employeeESI = { annual: employeeESIAnnual, monthly: employeeESIMonthly, pctOfGross: ((employeeESIAnnual / grossAnnual) * 100).toFixed(1) };
  }
  deductionsObj.professionalTax = { annual: professionalTaxAnnual, monthly: professionalTaxMonthly, pctOfGross: ((professionalTaxAnnual / grossAnnual) * 100).toFixed(1) };
  deductionsObj.incomeTax = { annual: tdsAnnual, monthly: tdsMonthly, pctOfGross: ((tdsAnnual / grossAnnual) * 100).toFixed(1), taxableIncome };

  return {
    country: 'India',
    countryCode: 'IND',
    currency: 'INR',
    ctcAnnual,
    ctcMonthly: Math.round(ctcAnnual / 12),
    earnings: {
      basic: { annual: basicAnnual, monthly: basicMonthly, pctOfCTC: ((basicAnnual / ctcAnnual) * 100).toFixed(1) },
      hra: { annual: hraAnnual, monthly: hraMonthly, pctOfCTC: ((hraAnnual / ctcAnnual) * 100).toFixed(1) },
      specialAllowance: { annual: specialAllowanceAnnual, monthly: specialAllowanceMonthly, pctOfCTC: ((specialAllowanceAnnual / ctcAnnual) * 100).toFixed(1) },
      lta: { annual: ltaAnnual, monthly: ltaMonthly, pctOfCTC: ((ltaAnnual / ctcAnnual) * 100).toFixed(1) },
      variablePay: { annual: variablePayAnnual, monthly: variablePayMonthly, pctOfCTC: ((variablePayAnnual / ctcAnnual) * 100).toFixed(1) },
      medicalAllowance: { annual: medicalAnnual, monthly: medicalMonthly, pctOfCTC: ((medicalAnnual / ctcAnnual) * 100).toFixed(1) },
      conveyanceAllowance: { annual: conveyanceAnnual, monthly: conveyanceMonthly, pctOfCTC: ((conveyanceAnnual / ctcAnnual) * 100).toFixed(1) },
    },
    grossSalary: { annual: grossAnnual, monthly: Math.round(grossAnnual / 12) },
    employerContributions: employerContribsObj,
    deductions: deductionsObj,
    totalDeductions: { annual: totalDeductionsAnnual, monthly: totalDeductionsMonthly },
    netTakeHome: { annual: netAnnual, monthly: netMonthly },
    meta: { includePF, includeESI, esiApplicable },
  };
}

// ─── US CTC Breakdown ───
function calculateUSCTCBreakdown(ctcAnnual: number) {
  const baseSalaryAnnual = Math.round(ctcAnnual * 0.70);
  const baseSalaryMonthly = Math.round(baseSalaryAnnual / 12);

  const bonusAnnual = Math.round(ctcAnnual * 0.10);
  const bonusMonthly = Math.round(bonusAnnual / 12);

  const stockOptionsAnnual = Math.round(ctcAnnual * 0.10);
  const stockOptionsMonthly = Math.round(stockOptionsAnnual / 12);

  const healthInsuranceAnnual = Math.round(ctcAnnual * 0.05);
  const healthInsuranceMonthly = Math.round(healthInsuranceAnnual / 12);

  const retirement401kEmployerAnnual = Math.round(baseSalaryAnnual * 0.05);
  const retirement401kEmployerMonthly = Math.round(retirement401kEmployerAnnual / 12);

  const otherBenefitsAnnual = Math.round(ctcAnnual * 0.05);
  const otherBenefitsMonthly = Math.round(otherBenefitsAnnual / 12);

  const grossAnnual = baseSalaryAnnual + bonusAnnual;
  const grossMonthly = Math.round(grossAnnual / 12);

  const federalTaxAnnual = Math.round(ctcAnnual * 0.15);
  const federalTaxMonthly = Math.round(federalTaxAnnual / 12);

  const stateTaxAnnual = Math.round(ctcAnnual * 0.05);
  const stateTaxMonthly = Math.round(stateTaxAnnual / 12);

  const socialSecurityAnnual = Math.round(Math.min(baseSalaryAnnual, 168600) * 0.062);
  const socialSecurityMonthly = Math.round(socialSecurityAnnual / 12);

  const medicareAnnual = Math.round(baseSalaryAnnual * 0.0145);
  const medicareMonthly = Math.round(medicareAnnual / 12);

  const healthInsuranceEmployeeAnnual = Math.round(healthInsuranceAnnual * 0.3);
  const healthInsuranceEmployeeMonthly = Math.round(healthInsuranceEmployeeAnnual / 12);

  const retirement401kEmployeeAnnual = Math.round(baseSalaryAnnual * 0.05);
  const retirement401kEmployeeMonthly = Math.round(retirement401kEmployeeAnnual / 12);

  const totalDeductionsAnnual = federalTaxAnnual + stateTaxAnnual + socialSecurityAnnual + medicareAnnual + healthInsuranceEmployeeAnnual + retirement401kEmployeeAnnual;
  const totalDeductionsMonthly = Math.round(totalDeductionsAnnual / 12);

  const netAnnual = grossAnnual - totalDeductionsAnnual;
  const netMonthly = Math.round(netAnnual / 12);

  return {
    country: 'United States',
    countryCode: 'USA',
    currency: 'USD',
    ctcAnnual,
    ctcMonthly: Math.round(ctcAnnual / 12),
    earnings: {
      baseSalary: { annual: baseSalaryAnnual, monthly: baseSalaryMonthly, pctOfCTC: ((baseSalaryAnnual / ctcAnnual) * 100).toFixed(1) },
      annualBonus: { annual: bonusAnnual, monthly: bonusMonthly, pctOfCTC: ((bonusAnnual / ctcAnnual) * 100).toFixed(1) },
      stockOptions: { annual: stockOptionsAnnual, monthly: stockOptionsMonthly, pctOfCTC: ((stockOptionsAnnual / ctcAnnual) * 100).toFixed(1) },
    },
    grossSalary: { annual: grossAnnual, monthly: Math.round(grossAnnual / 12) },
    employerContributions: {
      healthInsurance: { annual: healthInsuranceAnnual, monthly: healthInsuranceMonthly, pctOfCTC: ((healthInsuranceAnnual / ctcAnnual) * 100).toFixed(1) },
      retirement401k: { annual: retirement401kEmployerAnnual, monthly: retirement401kEmployerMonthly, pctOfCTC: ((retirement401kEmployerAnnual / ctcAnnual) * 100).toFixed(1) },
      otherBenefits: { annual: otherBenefitsAnnual, monthly: otherBenefitsMonthly, pctOfCTC: ((otherBenefitsAnnual / ctcAnnual) * 100).toFixed(1) },
    },
    deductions: {
      federalTax: { annual: federalTaxAnnual, monthly: federalTaxMonthly, pctOfGross: ((federalTaxAnnual / grossAnnual) * 100).toFixed(1) },
      stateTax: { annual: stateTaxAnnual, monthly: stateTaxMonthly, pctOfGross: ((stateTaxAnnual / grossAnnual) * 100).toFixed(1) },
      socialSecurity: { annual: socialSecurityAnnual, monthly: socialSecurityMonthly, pctOfGross: ((socialSecurityAnnual / grossAnnual) * 100).toFixed(1) },
      medicare: { annual: medicareAnnual, monthly: medicareMonthly, pctOfGross: ((medicareAnnual / grossAnnual) * 100).toFixed(1) },
      healthInsurance: { annual: healthInsuranceEmployeeAnnual, monthly: healthInsuranceEmployeeMonthly, pctOfGross: ((healthInsuranceEmployeeAnnual / grossAnnual) * 100).toFixed(1) },
      retirement401k: { annual: retirement401kEmployeeAnnual, monthly: retirement401kEmployeeMonthly, pctOfGross: ((retirement401kEmployeeAnnual / grossAnnual) * 100).toFixed(1) },
    },
    totalDeductions: { annual: totalDeductionsAnnual, monthly: totalDeductionsMonthly },
    netTakeHome: { annual: netAnnual, monthly: netMonthly },
  };
}

// ─── Template-based calculation ───
function calculateFromTemplate(
  ctcAnnual: number,
  template: {
    ctcType: string;
    basePayPct: number | null;
    componentMappings: Array<{
      componentName: string;
      componentCategory: string;
      allocationMethod: string;
      allocationValue: number;
      frequency: string;
    }>;
  }
) {
  const effectiveCTC = template.ctcType === 'MONTHLY' ? ctcAnnual * 12 : ctcAnnual;

  const earnings: Array<{ name: string; annual: number; monthly: number; pctOfCTC: string; category: string }> = [];
  const employerContributions: Array<{ name: string; annual: number; monthly: number; pctOfCTC: string }> = [];
  const deductions: Array<{ name: string; annual: number; monthly: number; pctOfGross: string; category: string }> = [];

  let grossAnnual = 0;

  for (const mapping of template.componentMappings) {
    let amount = 0;
    switch (mapping.allocationMethod) {
      case 'PERCENTAGE_OF_CTC':
        amount = (effectiveCTC * mapping.allocationValue) / 100;
        break;
      case 'FIXED_AMOUNT':
        amount = mapping.frequency === 'MONTHLY' ? mapping.allocationValue * 12 : mapping.allocationValue;
        break;
      case 'PERCENTAGE_OF_COMPONENT': {
        const basePct = template.basePayPct ?? 40;
        const baseAmount = (effectiveCTC * basePct) / 100;
        amount = (baseAmount * mapping.allocationValue) / 100;
        break;
      }
      default:
        amount = (effectiveCTC * mapping.allocationValue) / 100;
    }

    const annual = Math.round(amount);
    const monthly = Math.round(annual / 12);
    const pctOfCTC = ((annual / effectiveCTC) * 100).toFixed(1);

    if (mapping.componentCategory === 'EARNING' || mapping.componentCategory === 'REIMBURSEMENT' || mapping.componentCategory === 'BENEFIT_IN_KIND') {
      earnings.push({ name: mapping.componentName, annual, monthly, pctOfCTC, category: mapping.componentCategory });
      grossAnnual += annual;
    } else if (mapping.componentCategory === 'EMPLOYER_CONTRIBUTION') {
      employerContributions.push({ name: mapping.componentName, annual, monthly, pctOfCTC });
    } else if (mapping.componentCategory === 'DEDUCTION') {
      deductions.push({ name: mapping.componentName, annual, monthly, pctOfGross: '0', category: mapping.componentCategory });
    }
  }

  if (earnings.length === 0 && template.basePayPct) {
    const basicAnnual = Math.round((effectiveCTC * template.basePayPct) / 100);
    earnings.push({ name: 'Basic Salary', annual: basicAnnual, monthly: Math.round(basicAnnual / 12), pctOfCTC: template.basePayPct.toString(), category: 'EARNING' });
    grossAnnual = basicAnnual;
  }

  for (const d of deductions) {
    d.pctOfGross = grossAnnual > 0 ? ((d.annual / grossAnnual) * 100).toFixed(1) : '0';
  }

  const totalDeductionsAnnual = deductions.reduce((s, d) => s + d.annual, 0);
  const totalEmployerContribsAnnual = employerContributions.reduce((s, e) => s + e.annual, 0);
  const netAnnual = Math.max(0, grossAnnual - totalDeductionsAnnual);
  const netMonthly = Math.round(netAnnual / 12);

  return {
    templateName: 'Custom Template',
    ctcAnnual: effectiveCTC,
    ctcMonthly: Math.round(effectiveCTC / 12),
    earnings,
    grossSalary: { annual: grossAnnual, monthly: Math.round(grossAnnual / 12) },
    employerContributions,
    deductions,
    totalDeductions: { annual: totalDeductionsAnnual, monthly: Math.round(totalDeductionsAnnual / 12) },
    netTakeHome: { annual: netAnnual, monthly: netMonthly },
    meta: { includePF: true, includeESI: false, esiApplicable: false },
  };
}

export async function POST(request: NextRequest) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    const decoded = await verifyToken(token);
    if (!decoded) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });

    const body = await request.json();
    const { ctcAmount, countryCode = 'IND', ctcType = 'ANNUAL', templateId, includePF = true, includeESI = true } = body;

    if (!ctcAmount || ctcAmount <= 0) {
      return Response.json({ error: 'CTC amount must be greater than 0' }, { status: 400, headers: corsHeaders });
    }

    const effectiveCTC = ctcType === 'MONTHLY' ? ctcAmount * 12 : ctcAmount;

    if (templateId) {
      const template = await db.cTCTemplate.findUnique({
        where: { id: templateId },
        include: { componentMappings: { orderBy: { calculationSequence: 'asc' } } },
      });

      if (!template) {
        return Response.json({ error: 'Template not found' }, { status: 404, headers: corsHeaders });
      }

      const result = calculateFromTemplate(effectiveCTC, template);
      return Response.json({ data: result }, { headers: corsHeaders });
    }

    let result;
    switch (countryCode) {
      case 'IND':
        result = calculateIndiaCTCBreakdown(effectiveCTC, { includePF, includeESI });
        break;
      case 'USA':
        result = calculateUSCTCBreakdown(effectiveCTC);
        break;
      default:
        result = calculateIndiaCTCBreakdown(effectiveCTC, { includePF, includeESI });
    }

    return Response.json({ data: result }, { headers: corsHeaders });
  } catch (error: unknown) {
    console.error('Error calculating CTC breakdown:', error);
    return Response.json({ error: (error instanceof Error ? error.message : String(error)) }, { status: 500, headers: corsHeaders });
  }
}

export async function GET(request: NextRequest) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    const decoded = await verifyToken(token);
    if (!decoded) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });

    const templates = await db.cTCTemplate.findMany({
      where: { status: 'ACTIVE' },
      include: { componentMappings: { orderBy: { calculationSequence: 'asc' } } },
      orderBy: { isDefault: 'desc' },
    });

    return Response.json({ data: templates }, { headers: corsHeaders });
  } catch (error: unknown) {
    console.error('Error fetching templates for calculator:', error);
    return Response.json({ error: (error instanceof Error ? error.message : String(error)) }, { status: 500, headers: corsHeaders });
  }
}
