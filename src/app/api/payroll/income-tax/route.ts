import { getTokenFromHeaders, verifyToken } from '@/lib/auth';
import { NextRequest } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

// ─── Old Regime Tax Slabs (FY 2024-25) ───
function calculateOldRegimeTax(annualIncome: number, ageGroup: string): number {
  const basicExemption = ageGroup === 'ABOVE_80' ? 500000 : ageGroup === 'SENIOR' ? 300000 : 250000;
  if (annualIncome <= basicExemption) return 0;

  const slabs = ageGroup === 'ABOVE_80'
    ? [
        { limit: 500000, rate: 0 },
        { limit: 1000000, rate: 0.20 },
        { limit: Infinity, rate: 0.30 },
      ]
    : ageGroup === 'SENIOR'
    ? [
        { limit: 300000, rate: 0 },
        { limit: 500000, rate: 0.05 },
        { limit: 1000000, rate: 0.20 },
        { limit: Infinity, rate: 0.30 },
      ]
    : [
        { limit: 250000, rate: 0 },
        { limit: 500000, rate: 0.05 },
        { limit: 1000000, rate: 0.20 },
        { limit: Infinity, rate: 0.30 },
      ];

  let tax = 0;
  let remaining = annualIncome;
  let prevLimit = 0;
  for (const slab of slabs) {
    if (remaining <= 0) break;
    const taxableInSlab = Math.min(remaining, slab.limit - prevLimit);
    tax += taxableInSlab * slab.rate;
    remaining -= taxableInSlab;
    prevLimit = slab.limit;
  }

  // Section 87A rebate: If income <= 5L, tax = 0
  if (annualIncome <= 500000) tax = 0;

  return Math.round(tax);
}

// ─── New Regime Tax Slabs (FY 2024-25) ───
function calculateNewRegimeTax(annualIncome: number): number {
  const slabs = [
    { limit: 300000, rate: 0 },
    { limit: 700000, rate: 0.05 },
    { limit: 1000000, rate: 0.10 },
    { limit: 1200000, rate: 0.15 },
    { limit: 1500000, rate: 0.20 },
    { limit: Infinity, rate: 0.30 },
  ];

  let tax = 0;
  let remaining = annualIncome;
  let prevLimit = 0;
  for (const slab of slabs) {
    if (remaining <= 0) break;
    const taxableInSlab = Math.min(remaining, slab.limit - prevLimit);
    tax += taxableInSlab * slab.rate;
    remaining -= taxableInSlab;
    prevLimit = slab.limit;
  }

  // Section 87A rebate: If income <= 7L, tax = 0 under new regime
  if (annualIncome <= 700000) tax = 0;

  return Math.round(tax);
}

// ─── Calculate Surcharge ───
function calculateSurcharge(taxableIncome: number, tax: number, regime: string): number {
  if (regime === 'NEW') {
    if (taxableIncome > 20000000) return Math.round(tax * 0.25);
    if (taxableIncome > 10000000) return Math.round(tax * 0.15);
    if (taxableIncome > 5000000) return Math.round(tax * 0.10);
  } else {
    if (taxableIncome > 50000000) return Math.round(tax * 0.37);
    if (taxableIncome > 20000000) return Math.round(tax * 0.25);
    if (taxableIncome > 10000000) return Math.round(tax * 0.15);
    if (taxableIncome > 5000000) return Math.round(tax * 0.10);
  }
  return 0;
}

// ─── HRA Exemption Calculation (Old Regime only) ───
function calculateHRAExemption(actualHRA: number, basicSalary: number, rentPaid: number, isMetro: boolean): number {
  const pctOfBasic = isMetro ? 0.50 : 0.40;
  const hraExempt1 = actualHRA; // Actual HRA received
  const hraExempt2 = (basicSalary * pctOfBasic) - (rentPaid - basicSalary * 0.10); // Rent - 10% of basic
  const hraExempt3 = basicSalary * pctOfBasic; // 50%/40% of basic
  return Math.max(0, Math.min(hraExempt1, Math.max(0, hraExempt2), hraExempt3));
}

export async function POST(request: NextRequest) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    const decoded = await verifyToken(token);
    if (!decoded) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });

    const body = await request.json();
    const {
      annualGrossIncome,
      ageGroup = 'BELOW_60',
      regime = 'NEW',
      // Old regime deductions
      section80C = 0,
      section80D = 0,
      section80CCD = 0,
      section24b = 0,
      hraActual = 0,
      hraRentPaid = 0,
      hraIsMetro = false,
      basicSalary = 0,
      section80E = 0,
      section80G = 0,
      section80TTA = 0,
      otherDeductions = 0,
    } = body;

    if (!annualGrossIncome || annualGrossIncome <= 0) {
      return Response.json({ error: 'Annual gross income is required' }, { status: 400, headers: corsHeaders });
    }

    // ─── New Regime Calculation ───
    const newRegimeStandardDeduction = 75000; // FY 2024-25
    const newRegimeTaxableIncome = Math.max(0, annualGrossIncome - newRegimeStandardDeduction);
    const newRegimeTax = calculateNewRegimeTax(newRegimeTaxableIncome);
    const newRegimeSurcharge = calculateSurcharge(newRegimeTaxableIncome, newRegimeTax, 'NEW');
    const newRegimeCess = Math.round((newRegimeTax + newRegimeSurcharge) * 0.04);
    const newRegimeTotalTax = newRegimeTax + newRegimeSurcharge + newRegimeCess;

    // ─── Old Regime Calculation ───
    const oldRegimeStandardDeduction = 50000;
    const hraExemption = regime === 'OLD' || regime === 'BOTH'
      ? calculateHRAExemption(hraActual, basicSalary, hraRentPaid, hraIsMetro)
      : 0;
    const sec80C_Claimed = Math.min(section80C, 150000);
    const sec80D_Claimed = Math.min(section80D, ageGroup === 'SENIOR' ? 100000 : 75000);
    const sec80CCD_Claimed = Math.min(section80CCD, 50000);
    const sec24b_Claimed = Math.min(section24b, 200000);

    const oldRegimeTotalDeductions = oldRegimeStandardDeduction + hraExemption + sec80C_Claimed +
      sec80D_Claimed + sec80CCD_Claimed + sec24b_Claimed + section80E + section80G +
      Math.min(section80TTA, 10000) + otherDeductions;
    const oldRegimeTaxableIncome = Math.max(0, annualGrossIncome - oldRegimeTotalDeductions);
    const oldRegimeTax = calculateOldRegimeTax(oldRegimeTaxableIncome, ageGroup);
    const oldRegimeSurcharge = calculateSurcharge(oldRegimeTaxableIncome, oldRegimeTax, 'OLD');
    const oldRegimeCess = Math.round((oldRegimeTax + oldRegimeSurcharge) * 0.04);
    const oldRegimeTotalTax = oldRegimeTax + oldRegimeSurcharge + oldRegimeCess;

    // ─── Tax Slab Breakdown ───
    const newRegimeSlabs = [
      { from: 0, to: 300000, rate: 0, tax: 0 },
      { from: 300001, to: 700000, rate: 5, tax: 0 },
      { from: 700001, to: 1000000, rate: 10, tax: 0 },
      { from: 1000001, to: 1200000, rate: 15, tax: 0 },
      { from: 1200001, to: 1500000, rate: 20, tax: 0 },
      { from: 1500001, to: null, rate: 30, tax: 0 },
    ];
    let remaining = newRegimeTaxableIncome;
    let prevLimit = 0;
    const slabLimits = [300000, 700000, 1000000, 1200000, 1500000, Infinity];
    for (let i = 0; i < newRegimeSlabs.length; i++) {
      if (remaining <= 0) break;
      const taxableInSlab = Math.min(remaining, slabLimits[i] - prevLimit);
      newRegimeSlabs[i].tax = Math.round(taxableInSlab * (newRegimeSlabs[i].rate / 100));
      remaining -= taxableInSlab;
      prevLimit = slabLimits[i];
    }

    const result = {
      annualGrossIncome,
      ageGroup,
      selectedRegime: regime,
      newRegime: {
        standardDeduction: newRegimeStandardDeduction,
        totalDeductions: newRegimeStandardDeduction,
        taxableIncome: newRegimeTaxableIncome,
        tax: newRegimeTax,
        surcharge: newRegimeSurcharge,
        cess: newRegimeCess,
        totalTax: newRegimeTotalTax,
        monthlyTDS: Math.round(newRegimeTotalTax / 12),
        slabBreakdown: newRegimeSlabs,
      },
      oldRegime: {
        standardDeduction: oldRegimeStandardDeduction,
        hraExemption,
        section80C: sec80C_Claimed,
        section80D: sec80D_Claimed,
        section80CCD: sec80CCD_Claimed,
        section24b: sec24b_Claimed,
        section80E,
        section80G,
        section80TTA: Math.min(section80TTA, 10000),
        otherDeductions,
        totalDeductions: oldRegimeTotalDeductions,
        taxableIncome: oldRegimeTaxableIncome,
        tax: oldRegimeTax,
        surcharge: oldRegimeSurcharge,
        cess: oldRegimeCess,
        totalTax: oldRegimeTotalTax,
        monthlyTDS: Math.round(oldRegimeTotalTax / 12),
      },
      comparison: {
        betterRegime: newRegimeTotalTax < oldRegimeTotalTax ? 'NEW' : 'OLD',
        savings: Math.abs(newRegimeTotalTax - oldRegimeTotalTax),
      },
    };

    return Response.json({ data: result }, { headers: corsHeaders });
  } catch (error: unknown) {
    console.error('Error calculating income tax:', error);
    return Response.json({ error: (error instanceof Error ? error.message : String(error)) }, { status: 500, headers: corsHeaders });
  }
}

// GET: Fetch tax slab tables from database
export async function GET(request: NextRequest) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    const decoded = await verifyToken(token);
    if (!decoded) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });

    const taxSlabs = await db.taxSlabTable.findMany({
      include: { rateLines: { orderBy: { sequence: 'asc' } } },
      orderBy: { taxYear: 'desc' },
      take: 10,
    });

    return Response.json({ data: taxSlabs }, { headers: corsHeaders });
  } catch (error: unknown) {
    console.error('Error fetching tax slabs:', error);
    return Response.json({ error: (error instanceof Error ? error.message : String(error)) }, { status: 500, headers: corsHeaders });
  }
}
