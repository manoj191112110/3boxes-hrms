import { NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';
import { ensureSchemaSynced } from '@/lib/schema-sync';

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

// ─── MASTER DATA: Countries, Currencies, Languages ───
const COUNTRY_MASTER = [
  { code: 'IN', name: 'India', currency: 'INR', language: 'hi', payrollFrequency: 'MONTHLY', taxRegime: 'NEW', workingHours: 48, workingDays: 6, overtimeMultiplier: 2.0, pf: true, esi: true, gratuity: true, socialSecurity: false, pension: false, medicaid: false, labourLaw: 'Shops & Establishments Act', terminationNotice: 30, probation: 180, annualLeave: 15, dataResidency: false, dataRegion: 'ap-south-1' },
  { code: 'US', name: 'United States', currency: 'USD', language: 'en', payrollFrequency: 'SEMI_MONTHLY', taxRegime: 'PROGRESSIVE', workingHours: 40, workingDays: 5, overtimeMultiplier: 1.5, pf: false, esi: false, gratuity: false, socialSecurity: true, pension: false, medicaid: true, labourLaw: 'FLSA', terminationNotice: 14, probation: 90, annualLeave: 10, dataResidency: false, dataRegion: 'us-east-1' },
  { code: 'GB', name: 'United Kingdom', currency: 'GBP', language: 'en', payrollFrequency: 'MONTHLY', taxRegime: 'PROGRESSIVE', workingHours: 40, workingDays: 5, overtimeMultiplier: 1.5, pf: false, esi: false, gratuity: false, socialSecurity: true, pension: true, medicaid: false, labourLaw: 'Employment Rights Act 1996', terminationNotice: 28, probation: 180, annualLeave: 20, dataResidency: false, dataRegion: 'eu-west-2' },
  { code: 'AE', name: 'United Arab Emirates', currency: 'AED', language: 'ar', payrollFrequency: 'MONTHLY', taxRegime: null, workingHours: 40, workingDays: 5, overtimeMultiplier: 1.5, pf: false, esi: false, gratuity: true, socialSecurity: false, pension: false, medicaid: false, labourLaw: 'UAE Labour Law', terminationNotice: 30, probation: 180, annualLeave: 21, dataResidency: false, dataRegion: 'me-south-1' },
  { code: 'SG', name: 'Singapore', currency: 'SGD', language: 'en', payrollFrequency: 'MONTHLY', taxRegime: 'PROGRESSIVE', workingHours: 44, workingDays: 5, overtimeMultiplier: 1.5, pf: false, esi: false, gratuity: false, socialSecurity: true, pension: true, medicaid: false, labourLaw: 'Employment Act', terminationNotice: 14, probation: 90, annualLeave: 7, dataResidency: false, dataRegion: 'ap-southeast-1' },
  { code: 'AU', name: 'Australia', currency: 'AUD', language: 'en', payrollFrequency: 'MONTHLY', taxRegime: 'PROGRESSIVE', workingHours: 38, workingDays: 5, overtimeMultiplier: 1.5, pf: false, esi: false, gratuity: true, socialSecurity: true, pension: true, medicaid: true, labourLaw: 'Fair Work Act 2009', terminationNotice: 28, probation: 180, annualLeave: 20, dataResidency: false, dataRegion: 'ap-southeast-2' },
  { code: 'CA', name: 'Canada', currency: 'CAD', language: 'en', payrollFrequency: 'SEMI_MONTHLY', taxRegime: 'PROGRESSIVE', workingHours: 40, workingDays: 5, overtimeMultiplier: 1.5, pf: false, esi: false, gratuity: false, socialSecurity: true, pension: true, medicaid: true, labourLaw: 'Canada Labour Code', terminationNotice: 14, probation: 90, annualLeave: 10, dataResidency: false, dataRegion: 'ca-central-1' },
  { code: 'DE', name: 'Germany', currency: 'EUR', language: 'de', payrollFrequency: 'MONTHLY', taxRegime: 'PROGRESSIVE', workingHours: 40, workingDays: 5, overtimeMultiplier: 1.5, pf: false, esi: false, gratuity: false, socialSecurity: true, pension: true, medicaid: true, labourLaw: 'Arbeitsgesetz', terminationNotice: 28, probation: 180, annualLeave: 20, dataResidency: true, dataRegion: 'eu-central-1' },
  { code: 'FR', name: 'France', currency: 'EUR', language: 'fr', payrollFrequency: 'MONTHLY', taxRegime: 'PROGRESSIVE', workingHours: 35, workingDays: 5, overtimeMultiplier: 1.5, pf: false, esi: false, gratuity: false, socialSecurity: true, pension: true, medicaid: true, labourLaw: 'Code du Travail', terminationNotice: 30, probation: 120, annualLeave: 25, dataResidency: true, dataRegion: 'eu-west-3' },
  { code: 'SA', name: 'Saudi Arabia', currency: 'SAR', language: 'ar', payrollFrequency: 'MONTHLY', taxRegime: null, workingHours: 40, workingDays: 5, overtimeMultiplier: 1.5, pf: false, esi: false, gratuity: true, socialSecurity: true, pension: false, medicaid: false, labourLaw: 'Saudi Labour Law', terminationNotice: 30, probation: 90, annualLeave: 21, dataResidency: false, dataRegion: 'me-south-1' },
  { code: 'JP', name: 'Japan', currency: 'JPY', language: 'ja', payrollFrequency: 'MONTHLY', taxRegime: 'PROGRESSIVE', workingHours: 40, workingDays: 5, overtimeMultiplier: 1.25, pf: false, esi: false, gratuity: false, socialSecurity: true, pension: true, medicaid: true, labourLaw: 'Labour Standards Act', terminationNotice: 30, probation: 90, annualLeave: 10, dataResidency: false, dataRegion: 'ap-northeast-1' },
  { code: 'ZA', name: 'South Africa', currency: 'ZAR', language: 'en', payrollFrequency: 'MONTHLY', taxRegime: 'PROGRESSIVE', workingHours: 45, workingDays: 5, overtimeMultiplier: 1.5, pf: false, esi: false, gratuity: false, socialSecurity: true, pension: false, medicaid: true, labourLaw: 'BCEA', terminationNotice: 30, probation: 180, annualLeave: 15, dataResidency: false, dataRegion: 'af-south-1' },
  { code: 'MY', name: 'Malaysia', currency: 'MYR', language: 'ms', payrollFrequency: 'MONTHLY', taxRegime: 'PROGRESSIVE', workingHours: 48, workingDays: 6, overtimeMultiplier: 1.5, pf: true, esi: false, gratuity: false, socialSecurity: true, pension: true, medicaid: false, labourLaw: 'Employment Act 1955', terminationNotice: 30, probation: 180, annualLeave: 8, dataResidency: false, dataRegion: 'ap-southeast-3' },
  { code: 'PH', name: 'Philippines', currency: 'PHP', language: 'en', payrollFrequency: 'SEMI_MONTHLY', taxRegime: 'PROGRESSIVE', workingHours: 48, workingDays: 6, overtimeMultiplier: 1.25, pf: true, esi: true, gratuity: false, socialSecurity: true, pension: true, medicaid: true, labourLaw: 'Labor Code', terminationNotice: 30, probation: 180, annualLeave: 5, dataResidency: false, dataRegion: 'ap-southeast-1' },
  { code: 'NL', name: 'Netherlands', currency: 'EUR', language: 'nl', payrollFrequency: 'MONTHLY', taxRegime: 'PROGRESSIVE', workingHours: 40, workingDays: 5, overtimeMultiplier: 1.5, pf: false, esi: false, gratuity: false, socialSecurity: true, pension: true, medicaid: true, labourLaw: 'Dutch Civil Code', terminationNotice: 30, probation: 120, annualLeave: 20, dataResidency: true, dataRegion: 'eu-west-1' },
  { code: 'IE', name: 'Ireland', currency: 'EUR', language: 'en', payrollFrequency: 'MONTHLY', taxRegime: 'PROGRESSIVE', workingHours: 40, workingDays: 5, overtimeMultiplier: 1.5, pf: false, esi: false, gratuity: false, socialSecurity: true, pension: true, medicaid: false, labourLaw: 'Organisation of Working Time Act', terminationNotice: 28, probation: 180, annualLeave: 20, dataResidency: true, dataRegion: 'eu-west-1' },
  { code: 'BD', name: 'Bangladesh', currency: 'BDT', language: 'bn', payrollFrequency: 'MONTHLY', taxRegime: 'PROGRESSIVE', workingHours: 48, workingDays: 6, overtimeMultiplier: 2.0, pf: true, esi: false, gratuity: true, socialSecurity: false, pension: false, medicaid: false, labourLaw: 'Labour Act 2006', terminationNotice: 30, probation: 180, annualLeave: 10, dataResidency: false, dataRegion: 'ap-south-1' },
  { code: 'NP', name: 'Nepal', currency: 'NPR', language: 'ne', payrollFrequency: 'MONTHLY', taxRegime: 'PROGRESSIVE', workingHours: 48, workingDays: 6, overtimeMultiplier: 1.5, pf: true, esi: false, gratuity: true, socialSecurity: true, pension: false, medicaid: false, labourLaw: 'Labour Act 2017', terminationNotice: 30, probation: 180, annualLeave: 10, dataResidency: false, dataRegion: 'ap-south-1' },
  { code: 'LK', name: 'Sri Lanka', currency: 'LKR', language: 'si', payrollFrequency: 'MONTHLY', taxRegime: 'PROGRESSIVE', workingHours: 45, workingDays: 5, overtimeMultiplier: 1.5, pf: true, esi: true, gratuity: true, socialSecurity: false, pension: false, medicaid: false, labourLaw: 'Shop and Office Employees Act', terminationNotice: 30, probation: 180, annualLeave: 14, dataResidency: false, dataRegion: 'ap-south-1' },
  { code: 'ID', name: 'Indonesia', currency: 'IDR', language: 'id', payrollFrequency: 'MONTHLY', taxRegime: 'PROGRESSIVE', workingHours: 40, workingDays: 5, overtimeMultiplier: 1.5, pf: true, esi: true, gratuity: false, socialSecurity: true, pension: true, medicaid: true, labourLaw: 'Manpower Law', terminationNotice: 30, probation: 90, annualLeave: 12, dataResidency: false, dataRegion: 'ap-southeast-1' },
];

const CURRENCY_MASTER = [
  { code: 'INR', name: 'Indian Rupee', symbol: '₹' },
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'GBP', name: 'British Pound', symbol: '£' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$' },
  { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$' },
  { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ' },
  { code: 'SAR', name: 'Saudi Riyal', symbol: '﷼' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
  { code: 'ZAR', name: 'South African Rand', symbol: 'R' },
  { code: 'MYR', name: 'Malaysian Ringgit', symbol: 'RM' },
  { code: 'PHP', name: 'Philippine Peso', symbol: '₱' },
  { code: 'BDT', name: 'Bangladeshi Taka', symbol: '৳' },
  { code: 'NPR', name: 'Nepalese Rupee', symbol: 'रू' },
  { code: 'LKR', name: 'Sri Lankan Rupee', symbol: '₨' },
  { code: 'IDR', name: 'Indonesian Rupiah', symbol: 'Rp' },
];

const LANGUAGE_MASTER = [
  { code: 'en', name: 'English', rtl: false, ui: true, docs: true, email: true, help: true },
  { code: 'hi', name: 'Hindi', rtl: false, ui: true, docs: true, email: true, help: false },
  { code: 'ar', name: 'Arabic', rtl: true, ui: true, docs: true, email: true, help: false },
  { code: 'de', name: 'German', rtl: false, ui: true, docs: true, email: true, help: true },
  { code: 'fr', name: 'French', rtl: false, ui: true, docs: true, email: true, help: true },
  { code: 'es', name: 'Spanish', rtl: false, ui: true, docs: true, email: true, help: true },
  { code: 'ja', name: 'Japanese', rtl: false, ui: true, docs: true, email: true, help: true },
  { code: 'ms', name: 'Malay', rtl: false, ui: true, docs: false, email: true, help: false },
  { code: 'bn', name: 'Bengali', rtl: false, ui: true, docs: false, email: true, help: false },
  { code: 'ne', name: 'Nepali', rtl: false, ui: false, docs: false, email: false, help: false },
  { code: 'si', name: 'Sinhala', rtl: false, ui: false, docs: false, email: false, help: false },
  { code: 'id', name: 'Indonesian', rtl: false, ui: true, docs: true, email: true, help: false },
  { code: 'nl', name: 'Dutch', rtl: false, ui: true, docs: true, email: true, help: true },
  { code: 'pt', name: 'Portuguese', rtl: false, ui: true, docs: true, email: true, help: true },
  { code: 'zh', name: 'Chinese (Simplified)', rtl: false, ui: true, docs: true, email: true, help: true },
];

// Country-specific default payroll policies
function getDefaultPoliciesForCountry(countryCode: string): Array<{ policyName: string; policyType: string; category: string; policyContent: string }> {
  const country = COUNTRY_MASTER.find(c => c.code === countryCode);
  if (!country) return [];

  const policies: Array<{ policyName: string; policyType: string; category: string; policyContent: string }> = [];

  // Payroll Frequency policy
  policies.push({
    policyName: `${country.name} — Payroll Frequency`,
    policyType: 'PAYROLL_FREQUENCY',
    category: 'payroll',
    policyContent: JSON.stringify({
      frequency: country.payrollFrequency,
      processingDay: 25,
      paymentDay: country.payrollFrequency === 'SEMI_MONTHLY' ? 15 : 1,
      cutOffDay: 20,
      currencyCode: country.currency,
    }),
  });

  // Tax Regime policy
  if (country.taxRegime) {
    policies.push({
      policyName: `${country.name} — Tax Regime`,
      policyType: 'TAX_REGIME',
      category: 'payroll',
      policyContent: JSON.stringify({
        regimeType: country.taxRegime,
        deductionsAllowed: countryCode === 'IN',
        filingFrequency: countryCode === 'IN' ? 'ANNUAL' : 'ANNUAL',
        tdsApplicable: countryCode === 'IN',
      }),
    });
  }

  // Statutory Compliance policy
  const statutoryComponents: string[] = [];
  if (country.pf) statutoryComponents.push('PF');
  if (country.esi) statutoryComponents.push('ESI');
  if (country.socialSecurity) statutoryComponents.push('SOCIAL_SECURITY');
  if (country.pension) statutoryComponents.push('PENSION');
  if (country.medicaid) statutoryComponents.push('MEDICAL_AID');
  if (countryCode === 'IN') statutoryComponents.push('PT', 'LWF');
  if (statutoryComponents.length > 0) {
    policies.push({
      policyName: `${country.name} — Statutory Compliance`,
      policyType: 'STATUTORY_COMPLIANCE',
      category: 'compliance',
      policyContent: JSON.stringify({
        components: statutoryComponents,
        filingFrequency: 'MONTHLY',
        autoDeduct: true,
        employerContributionRequired: true,
      }),
    });
  }

  // Leave Policy
  policies.push({
    policyName: `${country.name} — Leave Policy`,
    policyType: 'LEAVE_POLICY',
    category: 'leave',
    policyContent: JSON.stringify({
      annualLeave: country.annualLeave,
      sickLeave: countryCode === 'IN' ? 7 : 10,
      casualLeave: countryCode === 'IN' ? 7 : 0,
      carryForward: true,
      maxCarryForward: 5,
      encashmentAllowed: true,
      maternityLeave: countryCode === 'IN' ? 182 : countryCode === 'US' ? 0 : 84,
      paternityLeave: countryCode === 'IN' ? 15 : 5,
    }),
  });

  // Overtime Policy
  policies.push({
    policyName: `${country.name} — Overtime Policy`,
    policyType: 'OVERTIME_POLICY',
    category: 'payroll',
    policyContent: JSON.stringify({
      multiplier: country.overtimeMultiplier,
      maxOTHoursPerWeek: 12,
      compOffEnabled: true,
      compOffExpiryDays: 30,
      requiresApproval: true,
    }),
  });

  // Gratuity Policy
  if (country.gratuity) {
    policies.push({
      policyName: `${country.name} — Gratuity Policy`,
      policyType: 'GRATUITY_POLICY',
      category: 'benefits',
      policyContent: JSON.stringify({
        eligibleAfterYears: countryCode === 'IN' ? 5 : 1,
        calculationBasis: 'LAST_DRAWN',
        multiplier: 15 / 26,
        maxCap: countryCode === 'IN' ? 2000000 : null,
      }),
    });
  }

  // Probation Policy
  policies.push({
    policyName: `${country.name} — Probation Policy`,
    policyType: 'PROBATION_POLICY',
    category: 'labour_law',
    policyContent: JSON.stringify({
      durationDays: country.probation,
      extendable: true,
      maxExtensionDays: 90,
      confirmationRequiresReview: true,
      noticeDuringProbation: 7,
    }),
  });

  // Termination Policy
  policies.push({
    policyName: `${country.name} — Termination Policy`,
    policyType: 'TERMINATION_POLICY',
    category: 'labour_law',
    policyContent: JSON.stringify({
      noticePeriodDays: country.terminationNotice,
      paymentInLieu: true,
      fnfTimelineDays: 30,
      gardenLeave: countryCode === 'GB',
      severancePay: countryCode !== 'IN',
    }),
  });

  // Working Hours Policy
  policies.push({
    policyName: `${country.name} — Working Hours`,
    policyType: 'WORKING_HOURS',
    category: 'labour_law',
    policyContent: JSON.stringify({
      hoursPerWeek: country.workingHours,
      daysPerWeek: country.workingDays,
      breakDurationMinutes: 30,
      maxContinuousHours: 5,
      flexibleTiming: countryCode !== 'IN',
    }),
  });

  // Social Security / PF / Pension
  if (country.socialSecurity || country.pension || country.pf) {
    policies.push({
      policyName: `${country.name} — Social Security & Retirement`,
      policyType: 'SOCIAL_SECURITY',
      category: 'benefits',
      policyContent: JSON.stringify({
        pfRate: country.pf ? 12 : 0,
        employerPFRate: country.pf ? 12 : 0,
        esiRate: country.esi ? 0.75 : 0,
        employerESIRate: country.esi ? 3.25 : 0,
        socialSecurityRate: country.socialSecurity ? 6.2 : 0,
        employerSocialSecurityRate: country.socialSecurity ? 6.2 : 0,
        pensionRate: country.pension ? 5 : 0,
        employerPensionRate: country.pension ? 3 : 0,
      }),
    });
  }

  // Minimum Wage
  policies.push({
    policyName: `${country.name} — Minimum Wage`,
    policyType: 'MINIMUM_WAGE',
    category: 'compliance',
    policyContent: JSON.stringify({
      currencyCode: country.currency,
      nationalMinimumWage: countryCode === 'IN' ? 17800 : countryCode === 'US' ? 7.25 * 160 : null,
      wageType: 'MONTHLY',
      regionSpecific: countryCode === 'IN' || countryCode === 'US',
      reviewFrequency: 'ANNUAL',
    }),
  });

  return policies;
}

// ─── GET: Retrieve tenant configuration ───
export async function GET(request: Request) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) {
      return NextResponse.json({ error: 'No token provided' }, { status: 401, headers: corsHeaders() });
    }

    const decoded = await verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401, headers: corsHeaders() });
    }

    const userRole = decoded.role as string;
    const tenantId = decoded.tenantId as string | undefined;

    // super_admin, tenant_admin, and admin can view tenant configuration
    if (userRole !== 'super_admin' && userRole !== 'tenant_admin' && userRole !== 'admin') {
      console.warn('[tenant-config] Access denied for role:', userRole);
      return NextResponse.json({ error: 'Access denied' }, { status: 403, headers: corsHeaders() });
    }

    const { searchParams } = new URL(request.url);
    let targetTenantId = searchParams.get('tenantId') || tenantId;

    // For super_admin without a tenantId, resolve from the request context (getDb)
    if (!targetTenantId && userRole === 'super_admin') {
      // Try to resolve tenant from the DB context
      try {
        const platformDb = getPlatformDb();
        const tenants = await platformDb.tenant.findMany({
          where: { slug: { in: ['3boxes-hrms-demo'] } },
          select: { id: true },
        });
        if (tenants.length > 0) {
          targetTenantId = tenants[0].id;
          console.log('[tenant-config] Resolved tenantId from platform DB for super_admin:', targetTenantId);
        }
      } catch (resolveErr) {
        console.error('[tenant-config] Failed to resolve tenant from platform DB:', resolveErr);
      }
    }

    // Fallback: if still no targetTenantId, try to find it from the user's record in the DB
    if (!targetTenantId && decoded.userId) {
      try {
        const userRecord = await db.user.findUnique({
          where: { id: decoded.userId as string },
          select: { tenantId: true },
        });
        if (userRecord?.tenantId) {
          targetTenantId = userRecord.tenantId;
          console.log('[tenant-config] Resolved tenantId from user record:', targetTenantId);
        }
      } catch (userResolveErr) {
        console.error('[tenant-config] Failed to resolve tenantId from user record:', userResolveErr);
      }
    }

    if (!targetTenantId) {
      console.error('[tenant-config] No tenant context available. userRole:', userRole, 'tenantId from JWT:', tenantId);
      return NextResponse.json({ error: 'No tenant context available. Please log in as a tenant admin or select a tenant.' }, { status: 400, headers: corsHeaders() });
    }

    // super_admin can view any tenant; tenant_admin and admin only their own
    if ((userRole === 'tenant_admin' || userRole === 'admin') && targetTenantId !== tenantId) {
      return NextResponse.json({ error: 'Access denied — you can only view your own tenant configuration' }, { status: 403, headers: corsHeaders() });
    }

    // Get or create the configuration
    let config = await db.tenantConfiguration.findUnique({
      where: { tenantId: targetTenantId },
      include: {
        countries: { where: { isActive: true }, orderBy: { countryName: 'asc' } },
        currencies: { where: { isActive: true }, orderBy: { currencyCode: 'asc' } },
        languages: { where: { isActive: true }, orderBy: { languageName: 'asc' } },
        policies: { orderBy: [{ countryCode: 'asc' }, { policyType: 'asc' }] },
      },
    });

    if (!config || (config.countries.length === 0 && config.currencies.length === 0 && config.languages.length === 0)) {
      // Auto-create with demo-friendly defaults and seed sample data
      // This also handles the case where config exists but is empty (e.g., created before seed feature was added)
      if (!config) {
        config = await db.tenantConfiguration.create({
          data: {
            tenantId: targetTenantId,
            autoProvisionPayroll: true,
            autoProvisionCompliance: true,
            autoProvisionTaxSlabs: true,
            autoProvisionMinWage: true,
            customisationTier: 'full',
            maxUsers: 500,
            maxCompanies: 10,
            maxEmployees: 5000,
          },
          include: {
            countries: true,
            currencies: true,
            languages: true,
            policies: true,
          },
        });
      }

      // Update existing config with demo-friendly defaults if needed
      if (config.customisationTier === 'standard' || config.maxUsers === 50) {
        await db.tenantConfiguration.update({
          where: { id: config.id },
          data: {
            autoProvisionPayroll: true,
            autoProvisionCompliance: true,
            autoProvisionTaxSlabs: true,
            autoProvisionMinWage: true,
            customisationTier: 'full',
            maxUsers: 500,
            maxCompanies: 10,
            maxEmployees: 5000,
          },
        });
      }

      // ─── Auto-seed sample data for demo ───
      // Each create is wrapped in try/catch so one failure doesn't break the whole seed
      const SAMPLE_COUNTRY_CODES = ['IN', 'US', 'GB', 'AE', 'SG', 'AU', 'CA', 'DE'];
      const SAMPLE_CURRENCY_CODES = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD', 'AUD', 'CAD'];
      const SAMPLE_LANGUAGE_CODES = ['en', 'hi', 'ar', 'de', 'fr'];

      for (const code of SAMPLE_COUNTRY_CODES) {
        const master = COUNTRY_MASTER.find(c => c.code === code);
        if (!master) continue;

        try {
          await db.tenantCountryAccess.create({
            data: {
              tenantConfigId: config.id,
              countryCode: code,
              countryName: master.name,
              payrollFrequencyDefault: master.payrollFrequency,
              payrollCurrencyDefault: master.currency,
              taxRegimeDefault: master.taxRegime,
              workingHoursPerWeek: master.workingHours,
              workingDaysPerWeek: master.workingDays,
              overtimeMultiplier: master.overtimeMultiplier,
              pfEnabled: master.pf,
              esiEnabled: master.esi,
              gratuityEnabled: master.gratuity,
              socialSecurityEnabled: master.socialSecurity,
              pensionEnabled: master.pension,
              medicaidEnabled: master.medicaid,
              labourLawCode: master.labourLaw,
              terminationNoticePeriod: master.terminationNotice,
              probationPeriod: master.probation,
              annualLeaveEntitlement: master.annualLeave,
              dataResidencyRequired: master.dataResidency,
              dataResidencyRegion: master.dataRegion,
            },
          });
        } catch (countryErr) {
          console.error(`[tenant-config] Failed to seed country ${code}:`, countryErr);
          continue; // Skip policies/currency/language for this country if the country itself failed
        }

        // Auto-provision payroll policies for each country
        const defaultPolicies = getDefaultPoliciesForCountry(code);
        for (const p of defaultPolicies) {
          try {
            await db.tenantPayrollPolicy.create({
              data: {
                tenantConfigId: config.id,
                countryCode: code,
                countryName: master.name,
                policyName: p.policyName,
                policyType: p.policyType,
                category: p.category,
                policyContent: p.policyContent,
                source: 'system_default',
                status: 'active',
                isEditable: true, // full tier allows editing
              },
            });
          } catch (policyErr) {
            console.error(`[tenant-config] Failed to seed policy ${p.policyType} for country ${code}:`, policyErr);
          }
        }

        // Auto-add the country's default currency
        const currencyMaster = CURRENCY_MASTER.find(c => c.code === master.currency);
        if (currencyMaster) {
          try {
            await db.tenantCurrencyAccess.upsert({
              where: { tenantConfigId_currencyCode: { tenantConfigId: config.id, currencyCode: currencyMaster.code } },
              update: { isActive: true },
              create: {
                tenantConfigId: config.id,
                currencyCode: currencyMaster.code,
                currencyName: currencyMaster.name,
                currencySymbol: currencyMaster.symbol,
              },
            });
          } catch (currErr) {
            console.error(`[tenant-config] Failed to seed currency ${currencyMaster.code} for country ${code}:`, currErr);
          }
        }

        // Auto-add the country's default language
        const langMaster = LANGUAGE_MASTER.find(l => l.code === master.language);
        if (langMaster) {
          try {
            await db.tenantLanguageAccess.upsert({
              where: { tenantConfigId_languageCode: { tenantConfigId: config.id, languageCode: langMaster.code } },
              update: { isActive: true },
              create: {
                tenantConfigId: config.id,
                languageCode: langMaster.code,
                languageName: langMaster.name,
                isRTL: langMaster.rtl,
                uiTranslated: langMaster.ui,
                documentTemplates: langMaster.docs,
                emailTemplates: langMaster.email,
                helpArticles: langMaster.help,
              },
            });
          } catch (langErr) {
            console.error(`[tenant-config] Failed to seed language ${langMaster.code} for country ${code}:`, langErr);
          }
        }
      }

      // Seed extra currencies not auto-added by countries
      const seededCurrencyCodes = new Set(SAMPLE_COUNTRY_CODES.map(c => COUNTRY_MASTER.find(m => m.code === c)?.currency).filter(Boolean));
      for (const code of SAMPLE_CURRENCY_CODES) {
        if (seededCurrencyCodes.has(code)) continue;
        const master = CURRENCY_MASTER.find(c => c.code === code);
        if (!master) continue;
        try {
          await db.tenantCurrencyAccess.create({
            data: {
              tenantConfigId: config.id,
              currencyCode: code,
              currencyName: master.name,
              currencySymbol: master.symbol,
            },
          });
        } catch (extraCurrErr) {
          console.error(`[tenant-config] Failed to seed extra currency ${code}:`, extraCurrErr);
        }
      }

      // Seed extra languages not auto-added by countries
      const seededLanguageCodes = new Set(SAMPLE_COUNTRY_CODES.map(c => COUNTRY_MASTER.find(m => m.code === c)?.language).filter(Boolean));
      for (const code of SAMPLE_LANGUAGE_CODES) {
        if (seededLanguageCodes.has(code)) continue;
        const master = LANGUAGE_MASTER.find(l => l.code === code);
        if (!master) continue;
        try {
          await db.tenantLanguageAccess.create({
            data: {
              tenantConfigId: config.id,
              languageCode: code,
              languageName: master.name,
              isRTL: master.rtl,
              uiTranslated: master.ui,
              documentTemplates: master.docs,
              emailTemplates: master.email,
              helpArticles: master.help,
            },
          });
        } catch (extraLangErr) {
          console.error(`[tenant-config] Failed to seed extra language ${code}:`, extraLangErr);
        }
      }

      // Update counts and costing (non-fatal if this fails)
      try {
        await updateConfigCounts(config.id);
      } catch (countErr) {
        console.error('[tenant-config] Failed to update config counts (non-fatal):', countErr);
      }

      // Re-fetch with all seeded data
      config = await db.tenantConfiguration.findUnique({
        where: { tenantId: targetTenantId },
        include: {
          countries: { where: { isActive: true }, orderBy: { countryName: 'asc' } },
          currencies: { where: { isActive: true }, orderBy: { currencyCode: 'asc' } },
          languages: { where: { isActive: true }, orderBy: { languageName: 'asc' } },
          policies: { orderBy: [{ countryCode: 'asc' }, { policyType: 'asc' }] },
        },
      });
    }

    // Return master data for selection UI
    return NextResponse.json({
      configuration: config,
      masterData: {
        countries: COUNTRY_MASTER,
        currencies: CURRENCY_MASTER,
        languages: LANGUAGE_MASTER,
      },
    }, { headers: corsHeaders() });
  } catch (error) {
    console.error('[tenant-config] GET handler error:', error);
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[tenant-config] Error details:', { message: msg, stack: error instanceof Error ? error.stack : undefined });
    // Self-heal: if table doesn't exist yet, try schema sync
    if (/does not exist|column .* does not exist/i.test(msg)) {
      try {
        await ensureSchemaSynced();
      } catch (syncErr) {
        console.error('[tenant-config] Schema sync also failed:', syncErr);
      }
      return NextResponse.json({ error: 'Schema was out of sync — auto-synced. Please retry.' }, { status: 503, headers: corsHeaders() });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}

// ─── POST: Add country/currency/language access, or create custom policy ───
export async function POST(request: Request) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) {
      return NextResponse.json({ error: 'No token provided' }, { status: 401, headers: corsHeaders() });
    }

    const decoded = await verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401, headers: corsHeaders() });
    }

    const userRole = decoded.role as string;
    const tenantId = decoded.tenantId as string;

    if (userRole !== 'super_admin' && userRole !== 'tenant_admin' && userRole !== 'admin') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403, headers: corsHeaders() });
    }

    const body = await request.json();
    const { action, tenantId: bodyTenantId } = body;

    const targetTenantId = bodyTenantId || tenantId;

    // super_admin can configure any tenant; tenant_admin and admin only their own
    if ((userRole === 'tenant_admin' || userRole === 'admin') && targetTenantId !== tenantId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403, headers: corsHeaders() });
    }

    // Ensure configuration exists
    let config = await db.tenantConfiguration.findUnique({
      where: { tenantId: targetTenantId },
    });
    if (!config) {
      config = await db.tenantConfiguration.create({
        data: { tenantId: targetTenantId },
      });
    }

    // ─── ACTION: add_countries ───
    if (action === 'add_countries') {
      const { countryCodes } = body; // Array of ISO codes
      if (!Array.isArray(countryCodes) || countryCodes.length === 0) {
        return NextResponse.json({ error: 'countryCodes array is required' }, { status: 400, headers: corsHeaders() });
      }

      const added = [];
      for (const code of countryCodes) {
        const master = COUNTRY_MASTER.find(c => c.code === code);
        if (!master) continue;

        // Upsert country access
        const countryAccess = await db.tenantCountryAccess.upsert({
          where: { tenantConfigId_countryCode: { tenantConfigId: config.id, countryCode: code } },
          update: { isActive: true, isOverridden: false },
          create: {
            tenantConfigId: config.id,
            countryCode: code,
            countryName: master.name,
            payrollFrequencyDefault: master.payrollFrequency,
            payrollCurrencyDefault: master.currency,
            taxRegimeDefault: master.taxRegime,
            workingHoursPerWeek: master.workingHours,
            workingDaysPerWeek: master.workingDays,
            overtimeMultiplier: master.overtimeMultiplier,
            pfEnabled: master.pf,
            esiEnabled: master.esi,
            gratuityEnabled: master.gratuity,
            socialSecurityEnabled: master.socialSecurity,
            pensionEnabled: master.pension,
            medicaidEnabled: master.medicaid,
            labourLawCode: master.labourLaw,
            terminationNoticePeriod: master.terminationNotice,
            probationPeriod: master.probation,
            annualLeaveEntitlement: master.annualLeave,
            dataResidencyRequired: master.dataResidency,
            dataResidencyRegion: master.dataRegion,
          },
        });
        added.push(countryAccess);

        // Auto-provision payroll policies
        if (config.autoProvisionPayroll) {
          const defaultPolicies = getDefaultPoliciesForCountry(code);
          for (const p of defaultPolicies) {
            // Check if policy already exists for this country+type
            const existing = await db.tenantPayrollPolicy.findFirst({
              where: { tenantConfigId: config.id, countryCode: code, policyType: p.policyType, source: 'system_default' },
            });
            if (!existing) {
              await db.tenantPayrollPolicy.create({
                data: {
                  tenantConfigId: config.id,
                  countryCode: code,
                  countryName: master.name,
                  policyName: p.policyName,
                  policyType: p.policyType,
                  category: p.category,
                  policyContent: p.policyContent,
                  source: 'system_default',
                  status: 'active',
                  isEditable: config.customisationTier !== 'standard',
                },
              });
            }
          }
        }

        // Auto-add the country's default currency
        if (config.autoProvisionPayroll) {
          const currencyMaster = CURRENCY_MASTER.find(c => c.code === master.currency);
          if (currencyMaster) {
            await db.tenantCurrencyAccess.upsert({
              where: { tenantConfigId_currencyCode: { tenantConfigId: config.id, currencyCode: currencyMaster.code } },
              update: { isActive: true },
              create: {
                tenantConfigId: config.id,
                currencyCode: currencyMaster.code,
                currencyName: currencyMaster.name,
                currencySymbol: currencyMaster.symbol,
              },
            });
          }
        }

        // Auto-add the country's default language
        if (config.autoProvisionPayroll) {
          const langMaster = LANGUAGE_MASTER.find(l => l.code === master.language);
          if (langMaster) {
            await db.tenantLanguageAccess.upsert({
              where: { tenantConfigId_languageCode: { tenantConfigId: config.id, languageCode: langMaster.code } },
              update: { isActive: true },
              create: {
                tenantConfigId: config.id,
                languageCode: langMaster.code,
                languageName: langMaster.name,
                isRTL: langMaster.rtl,
                uiTranslated: langMaster.ui,
                documentTemplates: langMaster.docs,
                emailTemplates: langMaster.email,
                helpArticles: langMaster.help,
              },
            });
          }
        }
      }

      // Update counts and costing
      await updateConfigCounts(config.id);

      await db.auditLog.create({
        data: {
          userId: decoded.userId as string,
          action: 'ADD_COUNTRY_ACCESS',
          module: 'tenant_configuration',
          details: `Added country access: ${countryCodes.join(', ')} for tenant ${targetTenantId}`,
        },
      });

      return NextResponse.json({ message: `Added ${added.length} countries with auto-provisioned policies`, added }, { headers: corsHeaders() });
    }

    // ─── ACTION: add_currencies ───
    if (action === 'add_currencies') {
      const { currencyCodes } = body;
      if (!Array.isArray(currencyCodes) || currencyCodes.length === 0) {
        return NextResponse.json({ error: 'currencyCodes array is required' }, { status: 400, headers: corsHeaders() });
      }

      const added = [];
      for (const code of currencyCodes) {
        const master = CURRENCY_MASTER.find(c => c.code === code);
        if (!master) continue;

        const currencyAccess = await db.tenantCurrencyAccess.upsert({
          where: { tenantConfigId_currencyCode: { tenantConfigId: config.id, currencyCode: code } },
          update: { isActive: true },
          create: {
            tenantConfigId: config.id,
            currencyCode: code,
            currencyName: master.name,
            currencySymbol: master.symbol,
          },
        });
        added.push(currencyAccess);
      }

      await updateConfigCounts(config.id);

      await db.auditLog.create({
        data: {
          userId: decoded.userId as string,
          action: 'ADD_CURRENCY_ACCESS',
          module: 'tenant_configuration',
          details: `Added currency access: ${currencyCodes.join(', ')} for tenant ${targetTenantId}`,
        },
      });

      return NextResponse.json({ message: `Added ${added.length} currencies`, added }, { headers: corsHeaders() });
    }

    // ─── ACTION: add_languages ───
    if (action === 'add_languages') {
      const { languageCodes } = body;
      if (!Array.isArray(languageCodes) || languageCodes.length === 0) {
        return NextResponse.json({ error: 'languageCodes array is required' }, { status: 400, headers: corsHeaders() });
      }

      const added = [];
      for (const code of languageCodes) {
        const master = LANGUAGE_MASTER.find(l => l.code === code);
        if (!master) continue;

        const langAccess = await db.tenantLanguageAccess.upsert({
          where: { tenantConfigId_languageCode: { tenantConfigId: config.id, languageCode: code } },
          update: { isActive: true },
          create: {
            tenantConfigId: config.id,
            languageCode: code,
            languageName: master.name,
            isRTL: master.rtl,
            uiTranslated: master.ui,
            documentTemplates: master.docs,
            emailTemplates: master.email,
            helpArticles: master.help,
          },
        });
        added.push(langAccess);
      }

      await updateConfigCounts(config.id);

      await db.auditLog.create({
        data: {
          userId: decoded.userId as string,
          action: 'ADD_LANGUAGE_ACCESS',
          module: 'tenant_configuration',
          details: `Added language access: ${languageCodes.join(', ')} for tenant ${targetTenantId}`,
        },
      });

      return NextResponse.json({ message: `Added ${added.length} languages`, added }, { headers: corsHeaders() });
    }

    // ─── ACTION: create_policy ───
    if (action === 'create_policy') {
      // tenant_admin and admin can create policies if customisationTier is 'custom' or 'full'
      if ((userRole === 'tenant_admin' || userRole === 'admin') && config.customisationTier === 'standard') {
        return NextResponse.json({ error: 'Your customisation tier does not allow creating custom policies. Contact super admin to upgrade.' }, { status: 403, headers: corsHeaders() });
      }

      const { countryCode, policyName, policyType, category, policyContent, notes } = body;
      if (!countryCode || !policyName || !policyType || !policyContent) {
        return NextResponse.json({ error: 'countryCode, policyName, policyType, and policyContent are required' }, { status: 400, headers: corsHeaders() });
      }

      // Verify the country is in the tenant's allowed list
      const countryAccess = await db.tenantCountryAccess.findFirst({
        where: { tenantConfigId: config.id, countryCode, isActive: true },
      });
      if (!countryAccess) {
        return NextResponse.json({ error: `Country ${countryCode} is not in the allowed list for this tenant. Add it first.` }, { status: 400, headers: corsHeaders() });
      }

      const policy = await db.tenantPayrollPolicy.create({
        data: {
          tenantConfigId: config.id,
          countryCode,
          countryName: countryAccess.countryName,
          policyName,
          policyType,
          category: category || 'custom',
          policyContent: typeof policyContent === 'string' ? policyContent : JSON.stringify(policyContent),
          source: (userRole === 'tenant_admin' || userRole === 'admin') ? 'tenant_override' : 'system_default',
          status: 'active',
          isEditable: true,
          notes,
        },
      });

      await db.auditLog.create({
        data: {
          userId: decoded.userId as string,
          action: 'CREATE_TENANT_POLICY',
          module: 'tenant_configuration',
          details: `Created policy "${policyName}" (${policyType}) for country ${countryCode}`,
        },
      });

      return NextResponse.json({ message: 'Policy created successfully', policy }, { status: 201, headers: corsHeaders() });
    }

    // ─── ACTION: update_config ─── (super admin only — update configuration envelope)
    if (action === 'update_config') {
      if (userRole !== 'super_admin') {
        return NextResponse.json({ error: 'Only super admin can update configuration envelope' }, { status: 403, headers: corsHeaders() });
      }

      const { autoProvisionPayroll, autoProvisionCompliance, autoProvisionTaxSlabs, autoProvisionMinWage, customisationTier, maxUsers, maxCompanies, maxEmployees, notes } = body;

      const updateData: Record<string, unknown> = {};
      if (autoProvisionPayroll !== undefined) updateData.autoProvisionPayroll = autoProvisionPayroll;
      if (autoProvisionCompliance !== undefined) updateData.autoProvisionCompliance = autoProvisionCompliance;
      if (autoProvisionTaxSlabs !== undefined) updateData.autoProvisionTaxSlabs = autoProvisionTaxSlabs;
      if (autoProvisionMinWage !== undefined) updateData.autoProvisionMinWage = autoProvisionMinWage;
      if (customisationTier !== undefined) {
        if (!['standard', 'custom', 'full'].includes(customisationTier)) {
          return NextResponse.json({ error: 'customisationTier must be standard, custom, or full' }, { status: 400, headers: corsHeaders() });
        }
        updateData.customisationTier = customisationTier;
      }
      if (maxUsers !== undefined) updateData.maxUsers = maxUsers;
      if (maxCompanies !== undefined) updateData.maxCompanies = maxCompanies;
      if (maxEmployees !== undefined) updateData.maxEmployees = maxEmployees;
      if (notes !== undefined) updateData.notes = notes;

      const updated = await db.tenantConfiguration.update({
        where: { id: config.id },
        data: updateData,
      });

      // If customisation tier changed, update isEditable on policies
      if (customisationTier) {
        await db.tenantPayrollPolicy.updateMany({
          where: { tenantConfigId: config.id, source: 'system_default' },
          data: { isEditable: customisationTier !== 'standard' },
        });
      }

      await db.auditLog.create({
        data: {
          userId: decoded.userId as string,
          action: 'UPDATE_TENANT_CONFIG',
          module: 'tenant_configuration',
          details: `Updated tenant configuration: ${JSON.stringify(updateData)}`,
        },
      });

      return NextResponse.json({ message: 'Configuration updated', configuration: updated }, { headers: corsHeaders() });
    }

    return NextResponse.json({ error: 'Invalid action. Use: add_countries, add_currencies, add_languages, create_policy, update_config' }, { status: 400, headers: corsHeaders() });
  } catch (error) {
    console.error('Tenant configuration POST error:', error);
    const msg = error instanceof Error ? error.message : String(error);
    if (/does not exist|column .* does not exist|unique constraint/i.test(msg)) {
      await ensureSchemaSynced();
    }
    return NextResponse.json({ error: 'Internal server error', details: msg }, { status: 500, headers: corsHeaders() });
  }
}

// ─── PATCH: Update country/currency/language access or policy ───
export async function PATCH(request: Request) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) {
      return NextResponse.json({ error: 'No token provided' }, { status: 401, headers: corsHeaders() });
    }

    const decoded = await verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401, headers: corsHeaders() });
    }

    const userRole = decoded.role as string;
    const tenantId = decoded.tenantId as string;

    if (userRole !== 'super_admin' && userRole !== 'tenant_admin' && userRole !== 'admin') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403, headers: corsHeaders() });
    }

    const body = await request.json();
    const { action, id: itemId } = body;

    // ─── ACTION: update_country ───
    if (action === 'update_country') {
      const countryAccess = await db.tenantCountryAccess.findUnique({ where: { id: itemId } });
      if (!countryAccess) {
        return NextResponse.json({ error: 'Country access not found' }, { status: 404, headers: corsHeaders() });
      }

      // Verify tenant access
      const config = await db.tenantConfiguration.findUnique({ where: { id: countryAccess.tenantConfigId } });
      if (!config || ((userRole === 'tenant_admin' || userRole === 'admin') && config.tenantId !== tenantId)) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403, headers: corsHeaders() });
      }

      // tenant_admin/admin can only override if customisation tier allows
      if ((userRole === 'tenant_admin' || userRole === 'admin') && config.customisationTier === 'standard') {
        return NextResponse.json({ error: 'Your tier does not allow editing country settings' }, { status: 403, headers: corsHeaders() });
      }

      const updateData: Record<string, unknown> = {};
      const allowedFields = [
        'payrollFrequencyDefault', 'payrollCurrencyDefault', 'taxRegimeDefault',
        'workingHoursPerWeek', 'workingDaysPerWeek', 'overtimeMultiplier',
        'pfEnabled', 'esiEnabled', 'gratuityEnabled', 'socialSecurityEnabled',
        'pensionEnabled', 'medicaidEnabled', 'labourLawCode',
        'terminationNoticePeriod', 'probationPeriod', 'annualLeaveEntitlement',
        'dataResidencyRequired', 'dataResidencyRegion', 'isActive', 'overrideNotes',
      ];

      // super_admin can also set isActive to false (remove access)
      for (const field of allowedFields) {
        if (body[field] !== undefined) updateData[field] = body[field];
      }

      if (Object.keys(updateData).length > 0) {
        updateData.isOverridden = userRole === 'tenant_admin' || userRole === 'admin';
        await db.tenantCountryAccess.update({ where: { id: itemId }, data: updateData });
        await updateConfigCounts(config.id);
      }

      await db.auditLog.create({
        data: {
          userId: decoded.userId as string,
          action: 'UPDATE_COUNTRY_ACCESS',
          module: 'tenant_configuration',
          details: `Updated country access ${countryAccess.countryCode}: ${JSON.stringify(updateData)}`,
        },
      });

      return NextResponse.json({ message: 'Country access updated' }, { headers: corsHeaders() });
    }

    // ─── ACTION: update_currency ───
    if (action === 'update_currency') {
      const currencyAccess = await db.tenantCurrencyAccess.findUnique({ where: { id: itemId } });
      if (!currencyAccess) {
        return NextResponse.json({ error: 'Currency access not found' }, { status: 404, headers: corsHeaders() });
      }

      const config = await db.tenantConfiguration.findUnique({ where: { id: currencyAccess.tenantConfigId } });
      if (!config || ((userRole === 'tenant_admin' || userRole === 'admin') && config.tenantId !== tenantId)) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403, headers: corsHeaders() });
      }

      const updateData: Record<string, unknown> = {};
      const fields = ['exchangeRateSource', 'autoFetchEnabled', 'fetchFrequency', 'roundingPrecision', 'roundingRule', 'gainLossAccount', 'isActive', 'overrideNotes'];
      for (const field of fields) {
        if (body[field] !== undefined) updateData[field] = body[field];
      }

      if (Object.keys(updateData).length > 0) {
        updateData.isOverridden = userRole === 'tenant_admin' || userRole === 'admin';
        await db.tenantCurrencyAccess.update({ where: { id: itemId }, data: updateData });
        await updateConfigCounts(config.id);
      }

      return NextResponse.json({ message: 'Currency access updated' }, { headers: corsHeaders() });
    }

    // ─── ACTION: update_language ───
    if (action === 'update_language') {
      const langAccess = await db.tenantLanguageAccess.findUnique({ where: { id: itemId } });
      if (!langAccess) {
        return NextResponse.json({ error: 'Language access not found' }, { status: 404, headers: corsHeaders() });
      }

      const config = await db.tenantConfiguration.findUnique({ where: { id: langAccess.tenantConfigId } });
      if (!config || ((userRole === 'tenant_admin' || userRole === 'admin') && config.tenantId !== tenantId)) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403, headers: corsHeaders() });
      }

      const updateData: Record<string, unknown> = {};
      const fields = ['uiTranslated', 'documentTemplates', 'emailTemplates', 'helpArticles', 'isActive', 'overrideNotes'];
      for (const field of fields) {
        if (body[field] !== undefined) updateData[field] = body[field];
      }

      if (Object.keys(updateData).length > 0) {
        updateData.isOverridden = userRole === 'tenant_admin' || userRole === 'admin';
        await db.tenantLanguageAccess.update({ where: { id: itemId }, data: updateData });
        await updateConfigCounts(config.id);
      }

      return NextResponse.json({ message: 'Language access updated' }, { headers: corsHeaders() });
    }

    // ─── ACTION: update_policy ───
    if (action === 'update_policy') {
      const policy = await db.tenantPayrollPolicy.findUnique({ where: { id: itemId } });
      if (!policy) {
        return NextResponse.json({ error: 'Policy not found' }, { status: 404, headers: corsHeaders() });
      }

      const config = await db.tenantConfiguration.findUnique({ where: { id: policy.tenantConfigId } });
      if (!config || ((userRole === 'tenant_admin' || userRole === 'admin') && config.tenantId !== tenantId)) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403, headers: corsHeaders() });
      }

      // tenant_admin/admin cannot edit if isEditable is false
      if ((userRole === 'tenant_admin' || userRole === 'admin') && !policy.isEditable) {
        return NextResponse.json({ error: 'This policy is not editable at your customisation tier' }, { status: 403, headers: corsHeaders() });
      }

      const updateData: Record<string, unknown> = {};
      const fields = ['policyName', 'policyContent', 'category', 'status', 'effectiveFrom', 'effectiveTo', 'notes'];
      for (const field of fields) {
        if (body[field] !== undefined) {
          updateData[field] = field === 'policyContent' && typeof body[field] !== 'string'
            ? JSON.stringify(body[field])
            : body[field];
        }
      }

      if (Object.keys(updateData).length > 0) {
        // Store previous version in override history
        const prevHistory = policy.overrideHistory ? JSON.parse(policy.overrideHistory) : [];
        prevHistory.push({
          version: policy.version,
          policyContent: policy.policyContent,
          updatedAt: new Date().toISOString(),
          updatedBy: decoded.userId,
        });

        // Increment version
        const vParts = policy.version.split('.');
        const newVersion = `${vParts[0]}.${parseInt(vParts[1] || '0') + 1}`;

        updateData.isOverridden = true;
        updateData.source = 'tenant_override';
        updateData.overrideHistory = JSON.stringify(prevHistory);
        updateData.version = newVersion;
        updateData.previousVersionId = policy.id;

        await db.tenantPayrollPolicy.update({ where: { id: itemId }, data: updateData });
      }

      await db.auditLog.create({
        data: {
          userId: decoded.userId as string,
          action: 'UPDATE_TENANT_POLICY',
          module: 'tenant_configuration',
          details: `Updated policy "${policy.policyName}" (${policy.policyType}) for ${policy.countryCode}`,
        },
      });

      return NextResponse.json({ message: 'Policy updated', version: updateData.version }, { headers: corsHeaders() });
    }

    // ─── ACTION: remove_country / remove_currency / remove_language ───
    if (action === 'remove_country' || action === 'remove_currency' || action === 'remove_language') {
      // Super admin only can remove access
      if (userRole !== 'super_admin') {
        return NextResponse.json({ error: 'Only super admin can remove access' }, { status: 403, headers: corsHeaders() });
      }

      if (action === 'remove_country') {
        await db.tenantCountryAccess.update({ where: { id: itemId }, data: { isActive: false } });
        // Also deactivate related policies
        const countryAccess = await db.tenantCountryAccess.findUnique({ where: { id: itemId } });
        if (countryAccess) {
          const config2 = await db.tenantConfiguration.findUnique({ where: { id: countryAccess.tenantConfigId } });
          if (config2) {
            await db.tenantPayrollPolicy.updateMany({
              where: { tenantConfigId: config2.id, countryCode: countryAccess.countryCode, source: 'system_default' },
              data: { status: 'inactive' },
            });
            await updateConfigCounts(config2.id);
          }
        }
      }
      if (action === 'remove_currency') {
        await db.tenantCurrencyAccess.update({ where: { id: itemId }, data: { isActive: false } });
        const currencyAccess = await db.tenantCurrencyAccess.findUnique({ where: { id: itemId } });
        if (currencyAccess) {
          const config2 = await db.tenantConfiguration.findUnique({ where: { id: currencyAccess.tenantConfigId } });
          if (config2) await updateConfigCounts(config2.id);
        }
      }
      if (action === 'remove_language') {
        await db.tenantLanguageAccess.update({ where: { id: itemId }, data: { isActive: false } });
        const langAccess = await db.tenantLanguageAccess.findUnique({ where: { id: itemId } });
        if (langAccess) {
          const config2 = await db.tenantConfiguration.findUnique({ where: { id: langAccess.tenantConfigId } });
          if (config2) await updateConfigCounts(config2.id);
        }
      }

      return NextResponse.json({ message: 'Access removed (deactivated)' }, { headers: corsHeaders() });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400, headers: corsHeaders() });
  } catch (error) {
    console.error('Tenant configuration PATCH error:', error);
    const msg = error instanceof Error ? error.message : String(error);
    if (/does not exist|column .* does not exist/i.test(msg)) {
      await ensureSchemaSynced();
    }
    return NextResponse.json({ error: 'Internal server error', details: msg }, { status: 500, headers: corsHeaders() });
  }
}

// ─── DELETE: Hard delete a custom policy ───
export async function DELETE(request: Request) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) {
      return NextResponse.json({ error: 'No token provided' }, { status: 401, headers: corsHeaders() });
    }

    const decoded = await verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401, headers: corsHeaders() });
    }

    const userRole = decoded.role as string;
    const tenantId = decoded.tenantId as string;

    if (userRole !== 'super_admin' && userRole !== 'tenant_admin' && userRole !== 'admin') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403, headers: corsHeaders() });
    }

    const { searchParams } = new URL(request.url);
    const policyId = searchParams.get('policyId');

    if (!policyId) {
      return NextResponse.json({ error: 'policyId is required' }, { status: 400, headers: corsHeaders() });
    }

    const policy = await db.tenantPayrollPolicy.findUnique({ where: { id: policyId } });
    if (!policy) {
      return NextResponse.json({ error: 'Policy not found' }, { status: 404, headers: corsHeaders() });
    }

    const config = await db.tenantConfiguration.findUnique({ where: { id: policy.tenantConfigId } });
    if (!config || ((userRole === 'tenant_admin' || userRole === 'admin') && config.tenantId !== tenantId)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403, headers: corsHeaders() });
    }

    // Can only delete custom or tenant_override policies
    if (policy.source === 'system_default' && userRole !== 'super_admin') {
      return NextResponse.json({ error: 'Cannot delete system default policies. Deactivate instead.' }, { status: 403, headers: corsHeaders() });
    }

    await db.tenantPayrollPolicy.delete({ where: { id: policyId } });

    await db.auditLog.create({
      data: {
        userId: decoded.userId as string,
        action: 'DELETE_TENANT_POLICY',
        module: 'tenant_configuration',
        details: `Deleted policy "${policy.policyName}" (${policy.policyType}) for ${policy.countryCode}`,
      },
    });

    return NextResponse.json({ message: 'Policy deleted' }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Tenant configuration DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}

// ─── Helper: Update counts and estimated costs ───
async function updateConfigCounts(configId: string) {
  const activeCountries = await db.tenantCountryAccess.count({ where: { tenantConfigId: configId, isActive: true } });
  const activeCurrencies = await db.tenantCurrencyAccess.count({ where: { tenantConfigId: configId, isActive: true } });
  const activeLanguages = await db.tenantLanguageAccess.count({ where: { tenantConfigId: configId, isActive: true } });

  // Simple costing model:
  // Base: $50/month per country access
  // Currency: $10/month per additional currency beyond the first
  // Language: $5/month per additional language beyond the first
  // Customisation: standard=$0, custom=$50, full=$150
  const config = await db.tenantConfiguration.findUnique({ where: { id: configId } });
  const countryCost = activeCountries * 50;
  const currencyCost = Math.max(0, activeCurrencies - 1) * 10;
  const languageCost = Math.max(0, activeLanguages - 1) * 5;
  const tierCost = config?.customisationTier === 'full' ? 150 : config?.customisationTier === 'custom' ? 50 : 0;
  const userCost = (config?.maxUsers || 50) * 0.5; // $0.50 per user
  const companyCost = (config?.maxCompanies || 5) * 5; // $5 per company
  const employeeCost = (config?.maxEmployees || 500) * 0.1; // $0.10 per employee

  const monthlyCost = countryCost + currencyCost + languageCost + tierCost + userCost + companyCost + employeeCost;
  const annualCost = monthlyCost * 12;

  await db.tenantConfiguration.update({
    where: { id: configId },
    data: {
      activeCountryCount: activeCountries,
      activeCurrencyCount: activeCurrencies,
      activeLanguageCount: activeLanguages,
      estimatedMonthlyCost: Math.round(monthlyCost * 100) / 100,
      estimatedAnnualCost: Math.round(annualCost * 100) / 100,
    },
  });
}
