import { NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';
import { ensureSchemaSynced } from '@/lib/schema-sync';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders() });
}

// ─── MASTER DATA (same as in route.ts) ───
const COUNTRY_MASTER = [
  { code: 'IN', name: 'India', currency: 'INR', language: 'hi', payrollFrequency: 'MONTHLY', taxRegime: 'NEW', workingHours: 48, workingDays: 6, overtimeMultiplier: 2.0, pf: true, esi: true, gratuity: true, socialSecurity: false, pension: false, medicaid: false, labourLaw: 'Shops & Establishments Act', terminationNotice: 30, probation: 180, annualLeave: 15, dataResidency: false, dataRegion: 'ap-south-1' },
  { code: 'US', name: 'United States', currency: 'USD', language: 'en', payrollFrequency: 'SEMI_MONTHLY', taxRegime: 'PROGRESSIVE', workingHours: 40, workingDays: 5, overtimeMultiplier: 1.5, pf: false, esi: false, gratuity: false, socialSecurity: true, pension: false, medicaid: true, labourLaw: 'FLSA', terminationNotice: 14, probation: 90, annualLeave: 10, dataResidency: false, dataRegion: 'us-east-1' },
  { code: 'GB', name: 'United Kingdom', currency: 'GBP', language: 'en', payrollFrequency: 'MONTHLY', taxRegime: 'PROGRESSIVE', workingHours: 40, workingDays: 5, overtimeMultiplier: 1.5, pf: false, esi: false, gratuity: false, socialSecurity: true, pension: true, medicaid: false, labourLaw: 'Employment Rights Act 1996', terminationNotice: 28, probation: 180, annualLeave: 20, dataResidency: false, dataRegion: 'eu-west-2' },
  { code: 'AE', name: 'United Arab Emirates', currency: 'AED', language: 'ar', payrollFrequency: 'MONTHLY', taxRegime: null, workingHours: 40, workingDays: 5, overtimeMultiplier: 1.5, pf: false, esi: false, gratuity: true, socialSecurity: false, pension: false, medicaid: false, labourLaw: 'UAE Labour Law', terminationNotice: 30, probation: 180, annualLeave: 21, dataResidency: false, dataRegion: 'me-south-1' },
  { code: 'SG', name: 'Singapore', currency: 'SGD', language: 'en', payrollFrequency: 'MONTHLY', taxRegime: 'PROGRESSIVE', workingHours: 44, workingDays: 5, overtimeMultiplier: 1.5, pf: false, esi: false, gratuity: false, socialSecurity: true, pension: true, medicaid: false, labourLaw: 'Employment Act', terminationNotice: 14, probation: 90, annualLeave: 7, dataResidency: false, dataRegion: 'ap-southeast-1' },
  { code: 'AU', name: 'Australia', currency: 'AUD', language: 'en', payrollFrequency: 'MONTHLY', taxRegime: 'PROGRESSIVE', workingHours: 38, workingDays: 5, overtimeMultiplier: 1.5, pf: false, esi: false, gratuity: true, socialSecurity: true, pension: true, medicaid: true, labourLaw: 'Fair Work Act 2009', terminationNotice: 28, probation: 180, annualLeave: 20, dataResidency: false, dataRegion: 'ap-southeast-2' },
  { code: 'CA', name: 'Canada', currency: 'CAD', language: 'en', payrollFrequency: 'SEMI_MONTHLY', taxRegime: 'PROGRESSIVE', workingHours: 40, workingDays: 5, overtimeMultiplier: 1.5, pf: false, esi: false, gratuity: false, socialSecurity: true, pension: true, medicaid: true, labourLaw: 'Canada Labour Code', terminationNotice: 14, probation: 90, annualLeave: 10, dataResidency: false, dataRegion: 'ca-central-1' },
  { code: 'DE', name: 'Germany', currency: 'EUR', language: 'de', payrollFrequency: 'MONTHLY', taxRegime: 'PROGRESSIVE', workingHours: 40, workingDays: 5, overtimeMultiplier: 1.5, pf: false, esi: false, gratuity: false, socialSecurity: true, pension: true, medicaid: true, labourLaw: 'Arbeitsgesetz', terminationNotice: 28, probation: 180, annualLeave: 20, dataResidency: true, dataRegion: 'eu-central-1' },
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
];

const LANGUAGE_MASTER = [
  { code: 'en', name: 'English', rtl: false, ui: true, docs: true, email: true, help: true },
  { code: 'hi', name: 'Hindi', rtl: false, ui: true, docs: true, email: true, help: false },
  { code: 'ar', name: 'Arabic', rtl: true, ui: true, docs: true, email: true, help: false },
  { code: 'de', name: 'German', rtl: false, ui: true, docs: true, email: true, help: true },
  { code: 'fr', name: 'French', rtl: false, ui: true, docs: true, email: true, help: true },
];

// Country-specific default payroll policies
function getDefaultPoliciesForCountry(countryCode: string): Array<{ policyName: string; policyType: string; category: string; policyContent: string }> {
  const country = COUNTRY_MASTER.find(c => c.code === countryCode);
  if (!country) return [];

  const policies: Array<{ policyName: string; policyType: string; category: string; policyContent: string }> = [];

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

  if (country.taxRegime) {
    policies.push({
      policyName: `${country.name} — Tax Regime`,
      policyType: 'TAX_REGIME',
      category: 'payroll',
      policyContent: JSON.stringify({
        regimeType: country.taxRegime,
        deductionsAllowed: countryCode === 'IN',
        filingFrequency: 'ANNUAL',
        tdsApplicable: countryCode === 'IN',
      }),
    });
  }

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

// ─── Helper: Update counts and estimated costs ───
async function updateConfigCounts(configId: string) {
  const activeCountries = await db.tenantCountryAccess.count({ where: { tenantConfigId: configId, isActive: true } });
  const activeCurrencies = await db.tenantCurrencyAccess.count({ where: { tenantConfigId: configId, isActive: true } });
  const activeLanguages = await db.tenantLanguageAccess.count({ where: { tenantConfigId: configId, isActive: true } });

  const config = await db.tenantConfiguration.findUnique({ where: { id: configId } });
  const countryCost = activeCountries * 50;
  const currencyCost = Math.max(0, activeCurrencies - 1) * 10;
  const languageCost = Math.max(0, activeLanguages - 1) * 5;
  const tierCost = config?.customisationTier === 'full' ? 150 : config?.customisationTier === 'custom' ? 50 : 0;
  const userCost = (config?.maxUsers || 50) * 0.5;
  const companyCost = (config?.maxCompanies || 5) * 5;
  const employeeCost = (config?.maxEmployees || 500) * 0.1;

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

// ─── GET: Check if seeded ───
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
    if (userRole !== 'super_admin' && userRole !== 'tenant_admin') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403, headers: corsHeaders() });
    }

    const tenantId = decoded.tenantId as string;
    const { searchParams } = new URL(request.url);
    const targetTenantId = searchParams.get('tenantId') || tenantId;

    const config = await db.tenantConfiguration.findUnique({
      where: { tenantId: targetTenantId },
      include: {
        countries: { where: { isActive: true } },
        currencies: { where: { isActive: true } },
        languages: { where: { isActive: true } },
        policies: { where: { status: 'active' } },
      },
    });

    const isSeeded = config
      ? config.countries.length > 0 || config.currencies.length > 0 || config.languages.length > 0
      : false;

    return NextResponse.json({
      isSeeded,
      countryCount: config?.countries.length || 0,
      currencyCount: config?.currencies.length || 0,
      languageCount: config?.languages.length || 0,
      policyCount: config?.policies.length || 0,
    }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Tenant configuration seed check error:', error);
    const msg = error instanceof Error ? error.message : String(error);
    if (/does not exist|column .* does not exist/i.test(msg)) {
      await ensureSchemaSynced();
      return NextResponse.json({ error: 'Schema sync in progress. Please retry.' }, { status: 503, headers: corsHeaders() });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}

// ─── POST: Seed sample data ───
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

    // Only super_admin and tenant_admin can seed
    if (userRole !== 'super_admin' && userRole !== 'tenant_admin') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403, headers: corsHeaders() });
    }

    const body = await request.json().catch(() => ({}));
    const targetTenantId = body.tenantId || tenantId;

    // tenant_admin can only seed their own tenant
    if (userRole === 'tenant_admin' && targetTenantId !== tenantId) {
      return NextResponse.json({ error: 'Access denied — you can only seed your own tenant' }, { status: 403, headers: corsHeaders() });
    }

    // Ensure configuration exists
    let config = await db.tenantConfiguration.findUnique({
      where: { tenantId: targetTenantId },
      include: {
        countries: { where: { isActive: true } },
        currencies: { where: { isActive: true } },
        languages: { where: { isActive: true } },
      },
    });

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
        },
      });
    }

    // Check if already seeded
    if (config.countries.length > 0) {
      return NextResponse.json({
        message: 'Configuration already has data. Use the UI to modify.',
        countryCount: config.countries.length,
        currencyCount: config.currencies.length,
        languageCount: config.languages.length,
      }, { headers: corsHeaders() });
    }

    const SAMPLE_COUNTRY_CODES = ['IN', 'US', 'GB', 'AE', 'SG', 'AU', 'CA', 'DE'];
    const SAMPLE_CURRENCY_CODES = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD', 'AUD', 'CAD'];
    const SAMPLE_LANGUAGE_CODES = ['en', 'hi', 'ar', 'de', 'fr'];

    // ─── Seed Countries ───
    let countriesAdded = 0;
    for (const code of SAMPLE_COUNTRY_CODES) {
      const master = COUNTRY_MASTER.find(c => c.code === code);
      if (!master) continue;

      await db.tenantCountryAccess.upsert({
        where: { tenantConfigId_countryCode: { tenantConfigId: config.id, countryCode: code } },
        update: { isActive: true },
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
      countriesAdded++;

      // Auto-provision payroll policies
      const defaultPolicies = getDefaultPoliciesForCountry(code);
      for (const p of defaultPolicies) {
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
              isEditable: true,
            },
          });
        }
      }

      // Auto-add the country's default currency
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

      // Auto-add the country's default language
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

    // ─── Seed additional currencies (beyond what countries auto-added) ───
    const existingCurrencyCodes = new Set(
      (await db.tenantCurrencyAccess.findMany({
        where: { tenantConfigId: config.id, isActive: true },
        select: { currencyCode: true },
      })).map(c => c.currencyCode)
    );

    let extraCurrenciesAdded = 0;
    for (const code of SAMPLE_CURRENCY_CODES) {
      if (existingCurrencyCodes.has(code)) continue;
      const master = CURRENCY_MASTER.find(c => c.code === code);
      if (!master) continue;

      await db.tenantCurrencyAccess.create({
        data: {
          tenantConfigId: config.id,
          currencyCode: code,
          currencyName: master.name,
          currencySymbol: master.symbol,
        },
      });
      extraCurrenciesAdded++;
    }

    // ─── Seed additional languages (beyond what countries auto-added) ───
    const existingLanguageCodes = new Set(
      (await db.tenantLanguageAccess.findMany({
        where: { tenantConfigId: config.id, isActive: true },
        select: { languageCode: true },
      })).map(l => l.languageCode)
    );

    let extraLanguagesAdded = 0;
    for (const code of SAMPLE_LANGUAGE_CODES) {
      if (existingLanguageCodes.has(code)) continue;
      const master = LANGUAGE_MASTER.find(l => l.code === code);
      if (!master) continue;

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
      extraLanguagesAdded++;
    }

    // Update counts
    await updateConfigCounts(config.id);

    // Get final counts
    const finalConfig = await db.tenantConfiguration.findUnique({
      where: { id: config.id },
      include: {
        countries: { where: { isActive: true } },
        currencies: { where: { isActive: true } },
        languages: { where: { isActive: true } },
        policies: { where: { status: 'active' } },
      },
    });

    return NextResponse.json({
      message: 'Sample data seeded successfully',
      summary: {
        countriesAdded,
        extraCurrenciesAdded,
        extraLanguagesAdded,
        totalCountries: finalConfig?.countries.length || 0,
        totalCurrencies: finalConfig?.currencies.length || 0,
        totalLanguages: finalConfig?.languages.length || 0,
        totalPolicies: finalConfig?.policies.length || 0,
        estimatedMonthlyCost: finalConfig?.estimatedMonthlyCost || 0,
        estimatedAnnualCost: finalConfig?.estimatedAnnualCost || 0,
      },
    }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Tenant configuration seed error:', error);
    const msg = error instanceof Error ? error.message : String(error);
    if (/does not exist|column .* does not exist/i.test(msg)) {
      await ensureSchemaSynced();
      return NextResponse.json({ error: 'Schema was out of sync — auto-synced. Please retry seeding.' }, { status: 503, headers: corsHeaders() });
    }
    return NextResponse.json({ error: 'Internal server error', details: msg }, { status: 500, headers: corsHeaders() });
  }
}
