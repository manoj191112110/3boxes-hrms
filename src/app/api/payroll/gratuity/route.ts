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

// POST: Calculate gratuity
export async function POST(request: NextRequest) {
  try {
    const token = getTokenFromHeaders(request);
    const decoded = await verifyToken(token);
    if (!decoded) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });

    const body = await request.json();
    const {
      basicSalary,
      da = 0,
      yearsOfService,
      monthsOfService = 0,
      isCoveredByAct = true, // Whether company is covered under Payment of Gratuity Act 1972
    } = body;

    if (!basicSalary || basicSalary <= 0) {
      return Response.json({ error: 'Basic salary is required' }, { status: 400, headers: corsHeaders });
    }
    if (!yearsOfService || yearsOfService < 0) {
      return Response.json({ error: 'Years of service is required' }, { status: 400, headers: corsHeaders });
    }

    const lastDrawnSalary = basicSalary + da;
    const totalYears = yearsOfService + (monthsOfService / 12);

    // Gratuity Calculation
    // Covered under Act: (15 × Last drawn salary × Years of service) / 26
    // Not covered: (15 × Last drawn salary × Years of service) / 30
    const denominator = isCoveredByAct ? 26 : 30;
    const gratuityAmount = (15 * lastDrawnSalary * totalYears) / denominator;
    const maxGratuity = 2000000; // ₹20,00,000 as per law
    const cappedGratuity = Math.min(gratuityAmount, maxGratuity);

    // Monthly provision for CTC calculation
    const monthlyProvision = (basicSalary * 0.0481); // ~4.81% of basic
    const annualProvision = monthlyProvision * 12;

    // Year-by-year projection
    const projection = [];
    for (let year = 1; year <= Math.ceil(totalYears) + 5; year++) {
      const projGratuity = Math.min((15 * lastDrawnSalary * year) / denominator, maxGratuity);
      projection.push({
        year,
        gratuityAmount: Math.round(projGratuity),
        monthlyProvision: Math.round(monthlyProvision),
        cumulativeProvision: Math.round(monthlyProvision * 12 * year),
      });
    }

    // Tax exemption calculation
    // Section 10(10): For government employees - fully exempt
    // For non-government: Least of following is exempt:
    //   1. Actual gratuity received
    //   2. ₹20,00,000
    //   3. 15 days salary × years of service
    const taxExemption = Math.min(cappedGratuity, maxGratuity, (15 * lastDrawnSalary * totalYears) / denominator);
    const taxableGratuity = Math.max(0, cappedGratuity - taxExemption);

    // Eligibility info
    const isEligible = totalYears >= 5;
    const yearsToEligibility = Math.max(0, 5 - totalYears);

    const result = {
      inputs: {
        basicSalary,
        da,
        lastDrawnSalary,
        yearsOfService,
        monthsOfService,
        totalYears: parseFloat(totalYears.toFixed(2)),
        isCoveredByAct,
      },
      calculation: {
        formula: isCoveredByAct
          ? '(15 × Last Drawn Salary × Years of Service) / 26'
          : '(15 × Last Drawn Salary × Years of Service) / 30',
        denominator,
        gratuityAmount: Math.round(gratuityAmount),
        maxGratuity,
        cappedGratuity: Math.round(cappedGratuity),
        isCapped: gratuityAmount > maxGratuity,
      },
      monthlyProvision: {
        rate: '4.81%',
        monthlyAmount: Math.round(monthlyProvision),
        annualAmount: Math.round(annualProvision),
        pctOfBasic: ((monthlyProvision / basicSalary) * 100).toFixed(2),
      },
      taxImplication: {
        sectionCode: 'Section 10(10)',
        taxExemption: Math.round(taxExemption),
        taxableAmount: Math.round(taxableGratuity),
      },
      eligibility: {
        isEligible,
        yearsToEligibility: parseFloat(yearsToEligibility.toFixed(1)),
        minimumServiceRequired: 5,
        note: isEligible
          ? 'Employee is eligible for gratuity (5+ years of continuous service)'
          : `Employee needs ${yearsToEligibility.toFixed(1)} more years of service to be eligible`,
      },
      projection,
    };

    return Response.json({ data: result }, { headers: corsHeaders });
  } catch (error: unknown) {
    console.error('Error calculating gratuity:', error);
    return Response.json({ error: (error instanceof Error ? error.message : String(error)) }, { status: 500, headers: corsHeaders });
  }
}

// GET: Return gratuity reference info
export async function GET() {
  const referenceData = {
    actName: 'Payment of Gratuity Act, 1972',
    eligibility: '5 years of continuous service',
    maxAmount: 2000000,
    formulaCovered: '(15 × Last Drawn Salary × Years of Service) / 26',
    formulaNotCovered: '(15 × Last Drawn Salary × Years of Service) / 30',
    taxSection: 'Section 10(10) of Income Tax Act',
    taxExemptionLimit: 2000000,
    notes: [
      'Gratuity is payable on termination of employment after 5 years of continuous service',
      'In case of death or disablement, the 5-year requirement is waived',
      'Maximum gratuity amount is capped at ₹20,00,000 (20 lakhs)',
      'For companies covered under the Act, 26 working days are considered per month',
      'For companies not covered under the Act, 30 days are considered per month',
      'Last drawn salary includes Basic + Dearness Allowance at the time of leaving',
      'Gratuity received is tax-exempt up to ₹20 lakhs under Section 10(10)',
    ],
  };

  return Response.json({ data: referenceData }, { headers: corsHeaders });
}
