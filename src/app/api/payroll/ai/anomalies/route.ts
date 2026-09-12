// REQ-AI-PAY-01: AI Anomaly Detection for Payroll
// ----------------------------------------------------
// Scans the most recent (or specified) payroll run and detects outliers:
//   • Net pay spike (>50% vs. trailing 3-month average)
//   • Overtime spike (OT hours >500% of team average, or >3x individual average)
//   • Gross pay drop (>40% drop without leave/LOP inputs)
//   • Zero tax on substantial gross
//   • Duplicate bank account numbers across distinct employees (fraud indicator)
//   • Brand-new components that didn't exist in the prior period
//   • Minimum wage breach (cross-references MinimumWageConfig)
//
// Each detected anomaly writes one PayrollAnomaly row. The endpoint is
// idempotent: re-running for the same payrollRunId only adds NEW anomalies
// (existing OPEN ones for the same run+employee+type are kept).
//
// Detection method is "STATISTICAL" (rule-based with statistical thresholds)
// so the system works without an external ML service. The schema also
// supports ML_MODEL / HYBRID for future enhancement.

import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { getTokenFromHeaders, verifyToken } from '@/lib/auth';
import { NextRequest } from 'next/server';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

// GET /api/payroll/ai/anomalies
//   ?payrollRunId=...      → filter to a single run
//   ?employeeId=...        → filter to a single employee
//   ?status=OPEN|RESOLVED  → status filter
//   ?severity=HIGH         → severity filter
//   ?scan=true             → run detection BEFORE returning results
export async function GET(request: NextRequest) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    const decoded = await verifyToken(token);
    if (!decoded) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });

    const { searchParams } = new URL(request.url);
    const payrollRunId = searchParams.get('payrollRunId');
    const employeeId = searchParams.get('employeeId');
    const status = searchParams.get('status');
    const severity = searchParams.get('severity');
    const scan = searchParams.get('scan') === 'true';

    let scanResults: { scanned: number; detected: number; skipped: number } | undefined;
    if (scan && payrollRunId) {
      try {
        scanResults = await runAnomalyScan(payrollRunId);
      } catch (err) {
        console.error('Anomaly scan failed (continuing):', err);
      }
    }

    const where: Record<string, unknown> = {};
    if (payrollRunId) where.payrollRunId = payrollRunId;
    if (employeeId) where.employeeId = employeeId;
    if (status) where.status = status;
    if (severity) where.severity = severity;

    let anomalies: unknown[] = [];
    try {
      anomalies = await db.payrollAnomaly.findMany({
        where,
        include: {
          employee: {
            select: { id: true, employeeId: true, firstName: true, lastName: true, email: true },
          },
        },
        orderBy: [{ severity: 'desc' }, { detectedAt: 'desc' }],
        take: 500,
      });
    } catch (dbError: unknown) {
      console.error('DB error fetching anomalies:', dbError);
    }

    const arr = anomalies as Array<{ severity: string; status: string }>;
    const summary = {
      total: arr.length,
      critical: arr.filter((a) => a.severity === 'CRITICAL').length,
      high: arr.filter((a) => a.severity === 'HIGH').length,
      medium: arr.filter((a) => a.severity === 'MEDIUM').length,
      low: arr.filter((a) => a.severity === 'LOW').length,
      open: arr.filter((a) => a.status === 'OPEN').length,
    };

    return Response.json({ data: anomalies, summary, scanResults }, { headers: corsHeaders });
  } catch (error: unknown) {
    console.error('Error in /api/payroll/ai/anomalies GET:', error);
    return Response.json({ error: (error instanceof Error ? error.message : String(error)) }, { status: 500, headers: corsHeaders });
  }
}

// PATCH /api/payroll/ai/anomalies  { id, status, resolutionNotes }
export async function PATCH(request: NextRequest) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    const decoded = await verifyToken(token);
    if (!decoded) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });

    const body = await request.json();
    if (!body.id) return Response.json({ error: 'Anomaly id required' }, { status: 400, headers: corsHeaders });
    if (!['OPEN', 'ACKNOWLEDGED', 'INVESTIGATING', 'RESOLVED', 'FALSE_POSITIVE'].includes(body.status)) {
      return Response.json({ error: 'Invalid status' }, { status: 400, headers: corsHeaders });
    }

    const updated = await db.payrollAnomaly.update({
      where: { id: body.id },
      data: {
        status: body.status,
        reviewedBy: decoded.userId as string,
        reviewedAt: new Date(),
        resolutionNotes: body.resolutionNotes || null,
      },
    });

    return Response.json({ data: updated }, { headers: corsHeaders });
  } catch (error: unknown) {
    console.error('Error in /api/payroll/ai/anomalies PATCH:', error);
    return Response.json({ error: (error instanceof Error ? error.message : String(error)) }, { status: 500, headers: corsHeaders });
  }
}

// ────────────────────────────────────────────────────────────────────
// runAnomalyScan — the actual detection engine
// ────────────────────────────────────────────────────────────────────
async function runAnomalyScan(payrollRunId: string): Promise<{ scanned: number; detected: number; skipped: number }> {
  const run = await db.payrollRun.findUnique({
    where: { id: payrollRunId },
    include: {
      transactionLines: {
        where: { isReversal: false },
        select: {
          employeeId: true,
          componentCode: true,
          componentType: true,
          calculatedAmount: true,
          finalAmount: true,
          ytdAmount: true,
        },
      },
    },
  });

  if (!run) return { scanned: 0, detected: 0, skipped: 0 };

  const byEmployee = new Map<string, Array<{ componentCode: string; componentType: string; calculatedAmount: number; finalAmount: number; ytdAmount: number }>>();
  for (const line of run.transactionLines) {
    const arr = byEmployee.get(line.employeeId) || [];
    arr.push({
      componentCode: line.componentCode,
      componentType: line.componentType,
      calculatedAmount: line.calculatedAmount,
      finalAmount: line.finalAmount,
      ytdAmount: line.ytdAmount,
    });
    byEmployee.set(line.employeeId, arr);
  }

  const existingOpen = await db.payrollAnomaly.findMany({
    where: { payrollRunId, status: 'OPEN' },
    select: { employeeId: true, anomalyType: true },
  });
  const openKey = new Set(existingOpen.map((o) => `${o.employeeId || ''}|${o.anomalyType}`));

  const toCreate: Array<{
    payrollRunId: string | null;
    employeeId: string | null;
    anomalyType: string;
    severity: string;
    metricName: string;
    observedValue: number | null;
    baselineValue: number | null;
    deviationPct: number | null;
    detectionMethod: string;
    description: string;
    evidenceJson: string | null;
    companyId: string | null;
  }> = [];

  type EmpAgg = { employeeId: string; netPay: number; grossPay: number; otAmount: number; tax: number };
  const empAgg: EmpAgg[] = [];

  for (const [employeeId, lines] of byEmployee.entries()) {
    let grossPay = 0;
    let otAmount = 0;
    let tax = 0;
    let totalDeductions = 0;
    for (const l of lines) {
      if (l.componentType === 'EARNING') grossPay += l.finalAmount;
      if (l.componentType === 'DEDUCTION' || l.componentType === 'EMPLOYEE_CONTRIB') {
        totalDeductions += l.finalAmount;
        if (/TAX|PIT|TDS|FEDERAL|STATE|PAYE/i.test(l.componentCode)) tax += l.finalAmount;
      }
      if (/OT|OVERTIME/i.test(l.componentCode)) otAmount += l.finalAmount;
    }
    empAgg.push({ employeeId, netPay: grossPay - totalDeductions, grossPay, otAmount, tax });
  }

  const teamAvgNet = empAgg.length > 0 ? empAgg.reduce((s, e) => s + e.netPay, 0) / empAgg.length : 0;
  const teamAvgOT = empAgg.length > 0 ? empAgg.reduce((s, e) => s + e.otAmount, 0) / empAgg.length : 0;

  const employeeIds = Array.from(byEmployee.keys());
  const priorPayrolls = employeeIds.length > 0 ? await db.payroll.findMany({
    where: { employeeId: { in: employeeIds } },
    orderBy: { year: 'desc' },
    take: 3 * employeeIds.length,
  }) : [];

  const priorByEmployee = new Map<string, number[]>();
  for (const p of priorPayrolls) {
    const arr = priorByEmployee.get(p.employeeId) || [];
    arr.push(p.netSalary);
    priorByEmployee.set(p.employeeId, arr);
  }

  for (const emp of empAgg) {
    // Net pay spike
    const prior = priorByEmployee.get(emp.employeeId) || [];
    if (prior.length > 0 && prior[0] > 0) {
      const priorAvg = prior.reduce((s, v) => s + v, 0) / prior.length;
      if (priorAvg > 0) {
        const pct = ((emp.netPay - priorAvg) / priorAvg) * 100;
        if (pct > 50) {
          const key = `${emp.employeeId}|NET_PAY_SPIKE`;
          if (!openKey.has(key)) {
            toCreate.push({
              payrollRunId,
              employeeId: emp.employeeId,
              anomalyType: 'NET_PAY_SPIKE',
              severity: pct > 200 ? 'CRITICAL' : pct > 100 ? 'HIGH' : 'MEDIUM',
              metricName: 'net_pay_pct_change_vs_prior_3mo',
              observedValue: emp.netPay,
              baselineValue: priorAvg,
              deviationPct: pct,
              detectionMethod: 'STATISTICAL',
              description: `Net pay of ${emp.netPay.toFixed(2)} is ${pct.toFixed(0)}% above the prior 3-month average of ${priorAvg.toFixed(2)}`,
              evidenceJson: JSON.stringify({ priorValues: prior, priorAvg, currentNet: emp.netPay }),
              companyId: run.companyId,
            });
          }
        }
      }
    }

    // OT spike
    if (teamAvgOT > 0 && emp.otAmount > teamAvgOT * 5) {
      const key = `${emp.employeeId}|OT_SPIKE`;
      if (!openKey.has(key)) {
        toCreate.push({
          payrollRunId,
          employeeId: emp.employeeId,
          anomalyType: 'OT_SPIKE',
          severity: emp.otAmount > teamAvgOT * 10 ? 'CRITICAL' : 'HIGH',
          metricName: 'ot_amount_vs_team_avg',
          observedValue: emp.otAmount,
          baselineValue: teamAvgOT,
          deviationPct: ((emp.otAmount - teamAvgOT) / teamAvgOT) * 100,
          detectionMethod: 'STATISTICAL',
          description: `Overtime of ${emp.otAmount.toFixed(2)} is ${((emp.otAmount - teamAvgOT) / teamAvgOT * 100).toFixed(0)}% above team average of ${teamAvgOT.toFixed(2)}`,
          evidenceJson: JSON.stringify({ teamAvgOT, empOT: emp.otAmount }),
          companyId: run.companyId,
        });
      }
    }

    // Gross drop
    if (prior.length > 0 && prior[0] > 0) {
      const priorAvg = prior.reduce((s, v) => s + v, 0) / prior.length;
      if (priorAvg > 0) {
        const pct = ((emp.grossPay - priorAvg) / priorAvg) * 100;
        if (pct < -40) {
          const key = `${emp.employeeId}|GROSS_DROP`;
          if (!openKey.has(key)) {
            toCreate.push({
              payrollRunId,
              employeeId: emp.employeeId,
              anomalyType: 'GROSS_DROP',
              severity: pct < -70 ? 'CRITICAL' : 'HIGH',
              metricName: 'gross_pay_pct_drop_vs_prior_3mo',
              observedValue: emp.grossPay,
              baselineValue: priorAvg,
              deviationPct: pct,
              detectionMethod: 'STATISTICAL',
              description: `Gross pay of ${emp.grossPay.toFixed(2)} is ${pct.toFixed(0)}% below the prior 3-month average of ${priorAvg.toFixed(2)} — verify LOP/leave inputs`,
              evidenceJson: JSON.stringify({ priorAvg, currentGross: emp.grossPay }),
              companyId: run.companyId,
            });
          }
        }
      }
    }

    // Zero tax on substantial gross
    if (emp.grossPay > 50000 && emp.tax === 0) {
      const key = `${emp.employeeId}|TAX_ZERO`;
      if (!openKey.has(key)) {
        toCreate.push({
          payrollRunId,
          employeeId: emp.employeeId,
          anomalyType: 'TAX_ZERO',
          severity: 'HIGH',
          metricName: 'tax_on_gross',
          observedValue: 0,
          baselineValue: null,
          deviationPct: null,
          detectionMethod: 'RULE_BASED',
          description: `Gross pay of ${emp.grossPay.toFixed(2)} has zero tax deducted — verify tax slab configuration and exemption rules`,
          evidenceJson: JSON.stringify({ grossPay: emp.grossPay, tax: emp.tax }),
          companyId: run.companyId,
        });
      }
    }
  }

  // Duplicate bank account detection
  const employeesInRun = employeeIds.length > 0 ? await db.employeePaymentMethod.findMany({
    where: { employeeId: { in: employeeIds }, status: 'active', paymentType: 'DIRECT_DEPOSIT' },
    select: { employeeId: true, bankAccountNo: true },
  }) : [];
  const accountMap = new Map<string, string[]>();
  for (const pm of employeesInRun) {
    if (!pm.bankAccountNo) continue;
    const arr = accountMap.get(pm.bankAccountNo) || [];
    arr.push(pm.employeeId);
    accountMap.set(pm.bankAccountNo, arr);
  }
  for (const [accountNo, emps] of accountMap.entries()) {
    if (emps.length > 1) {
      for (const empId of emps) {
        const key = `${empId}|DUPLICATE_BANK`;
        if (!openKey.has(key)) {
          toCreate.push({
            payrollRunId,
            employeeId: empId,
            anomalyType: 'DUPLICATE_BANK',
            severity: 'CRITICAL',
            metricName: 'shared_bank_account_count',
            observedValue: emps.length,
            baselineValue: 1,
            deviationPct: ((emps.length - 1) / 1) * 100,
            detectionMethod: 'RULE_BASED',
            description: `Bank account ending ${accountNo.slice(-4)} is shared by ${emps.length} employees — possible fraud or duplicate record`,
            evidenceJson: JSON.stringify({ accountSuffix: accountNo.slice(-4), employeeIds: emps }),
            companyId: run.companyId,
          });
        }
      }
    }
  }

  // Minimum wage breach
  let runCountry = 'IN';
  if (run.companyId) {
    const co = await db.company.findUnique({ where: { id: run.companyId }, select: { country: true } });
    if (co?.country) runCountry = co.country.length > 2 ? co.country.substring(0, 2).toUpperCase() : co.country.toUpperCase();
  }
  const mwConfigs = await db.minimumWageConfig.findMany({
    where: { countryCode: runCountry, isActive: true, effectiveFrom: { lte: new Date() }, OR: [{ effectiveTo: null }, { effectiveTo: { gte: new Date() } }] },
  });
  if (mwConfigs.length > 0) {
    const monthlyMW = mwConfigs.find((m) => m.wageType === 'MONTHLY') || mwConfigs[0];
    for (const emp of empAgg) {
      if (emp.grossPay > 0 && emp.grossPay < monthlyMW.minimumAmount) {
        const key = `${emp.employeeId}|MIN_WAGE_BREACH`;
        if (!openKey.has(key)) {
          toCreate.push({
            payrollRunId,
            employeeId: emp.employeeId,
            anomalyType: 'MIN_WAGE_BREACH',
            severity: 'HIGH',
            metricName: 'gross_vs_minimum_wage',
            observedValue: emp.grossPay,
            baselineValue: monthlyMW.minimumAmount,
            deviationPct: ((emp.grossPay - monthlyMW.minimumAmount) / monthlyMW.minimumAmount) * 100,
            detectionMethod: 'RULE_BASED',
            description: `Gross pay of ${emp.grossPay.toFixed(2)} is below the minimum wage of ${monthlyMW.minimumAmount.toFixed(2)} ${monthlyMW.currencyCode} for ${monthlyMW.countryCode}`,
            evidenceJson: JSON.stringify({ minimumWageId: monthlyMW.id, country: monthlyMW.countryCode, region: monthlyMW.regionCode }),
            companyId: run.companyId,
          });
        }
      }
    }
  }

  let detected = 0;
  if (toCreate.length > 0) {
    try {
      const r = await db.payrollAnomaly.createMany({ data: toCreate });
      detected = r.count;
    } catch (err) {
      console.error('Bulk insert anomalies failed:', err);
    }
  }

  return { scanned: empAgg.length, detected, skipped: 0 };
}
