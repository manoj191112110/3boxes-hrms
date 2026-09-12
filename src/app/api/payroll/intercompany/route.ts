// REQ-PAY-25: Inter-Company Accounting
// -------------------------------------
// If an employee from Sub-Company A works on a project for Sub-Company B,
// the payroll engine must generate an inter-company journal entry:
//   Dr.  Sub-B Project Cost (Department / Project cost center)
//   Cr.  Sub-B Payable to Sub-A (Inter-company payable account)
//
// This endpoint computes inter-company JEs by inspecting:
//   • PayrollTransactionLine rows in the run
//   • Each line's dimensionSplitJson (which can include a "company"
//     dimension key when the employee's time was split across companies)
//   • EmployeeDimensionAllocation for cross-company allocations
//
// The response is a list of proposed inter-company JEs — the caller (a
// finance system or the bank-file generator) can post them to the GL.

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

// GET /api/payroll/intercompany?payrollRunId=...
// Computes inter-company JEs for the specified run.
export async function GET(request: NextRequest) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    const decoded = await verifyToken(token);
    if (!decoded) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });

    const { searchParams } = new URL(request.url);
    const payrollRunId = searchParams.get('payrollRunId');
    if (!payrollRunId) return Response.json({ error: 'payrollRunId required' }, { status: 400, headers: corsHeaders });

    const run = await db.payrollRun.findUnique({
      where: { id: payrollRunId },
      include: {
        transactionLines: {
          where: { isReversal: false },
          select: {
            id: true, employeeId: true, componentCode: true, componentType: true,
            finalAmount: true, currencyCode: true, glAccountCode: true,
            costCenterCode: true, dimensionSplitJson: true,
          },
        },
      },
    });

    if (!run) return Response.json({ error: 'Payroll run not found' }, { status: 404, headers: corsHeaders });

    // Resolve the home company of the run
    const homeCompanyId = run.companyId;
    if (!homeCompanyId) {
      return Response.json({ data: [], message: 'Run has no companyId — cannot compute inter-company JEs.' }, { headers: corsHeaders });
    }

    const homeCompany = await db.company.findUnique({
      where: { id: homeCompanyId },
      select: { id: true, name: true, currency: true },
    });

    // Build inter-company JE map: key = `${fromCompanyId}->${toCompanyId}` → aggregated amount
    const jeMap = new Map<string, { fromCompanyId: string; fromCompanyName: string; toCompanyId: string; toCompanyName: string; totalAmount: number; currency: string; lines: Array<{ employeeId: string; componentCode: string; amount: number; costCenterCode: string | null; glAccountCode: string | null }> }>();

    // Process each transaction line — check dimensionSplitJson for cross-company splits
    for (const line of run.transactionLines) {
      let crossCompanySplits: Array<{ toCompanyId: string; pct: number }> = [];

      // 1) Check dimensionSplitJson for a "company" key
      if (line.dimensionSplitJson) {
        try {
          const parsed = JSON.parse(line.dimensionSplitJson) as Record<string, Record<string, number>>;
          if (parsed.COMPANY) {
            for (const [companyId, pct] of Object.entries(parsed.COMPANY)) {
              if (companyId !== homeCompanyId && pct > 0) {
                crossCompanySplits.push({ toCompanyId: companyId, pct });
              }
            }
          }
        } catch {
          // ignore malformed JSON
        }
      }

      // 2) If no explicit split, check EmployeeDimensionAllocation for a cross-company allocation
      if (crossCompanySplits.length === 0) {
        try {
          const allocations = await db.employeeDimensionAllocation.findMany({
            where: { employeeId: line.employeeId, effectiveTo: null },
            include: { dimension: { select: { code: true } } },
          });
          for (const a of allocations) {
            if (a.dimension.code === 'COMPANY' && a.dimensionValueId !== homeCompanyId && a.allocationPct > 0) {
              crossCompanySplits.push({ toCompanyId: a.dimensionValueId, pct: a.allocationPct });
            }
          }
        } catch (err) {
          // ignore — EmployeeDimensionAllocation might not be populated
        }
      }

      // For each cross-company split, add to the JE map
      for (const split of crossCompanySplits) {
        const amount = line.finalAmount * (split.pct / 100);
        const key = `${homeCompanyId}->${split.toCompanyId}`;
        let entry = jeMap.get(key);
        if (!entry) {
          // Resolve company names (lazy-load)
          let toCompanyName = split.toCompanyId;
          try {
            const toCo = await db.company.findUnique({ where: { id: split.toCompanyId }, select: { name: true } });
            if (toCo) toCompanyName = toCo.name;
          } catch { /* ignore */ }
          entry = {
            fromCompanyId: homeCompanyId,
            fromCompanyName: homeCompany?.name || homeCompanyId,
            toCompanyId: split.toCompanyId,
            toCompanyName,
            totalAmount: 0,
            currency: line.currencyCode,
            lines: [],
          };
          jeMap.set(key, entry);
        }
        entry.totalAmount += amount;
        entry.lines.push({
          employeeId: line.employeeId,
          componentCode: line.componentCode,
          amount,
          costCenterCode: line.costCenterCode,
          glAccountCode: line.glAccountCode,
        });
      }
    }

    // Format the final response — each entry becomes a proposed double-entry JE
    const jeProposals = Array.from(jeMap.values()).map((entry) => ({
      fromCompanyId: entry.fromCompanyId,
      fromCompanyName: entry.fromCompanyName,
      toCompanyId: entry.toCompanyId,
      toCompanyName: entry.toCompanyName,
      currency: entry.currency,
      totalAmount: entry.totalAmount,
      journalEntry: {
        // Inter-company payable — Sub-B owes Sub-A for the labor cost
        debit: {
          accountCode: 'IC-PROJECT-COST',
          accountName: `Project Cost (Inter-company from ${entry.fromCompanyName})`,
          amount: entry.totalAmount,
          costCenter: entry.toCompanyId,
          description: `Inter-company labor cost allocation from ${entry.fromCompanyName} to ${entry.toCompanyName} for payroll period ${run.payrollPeriod}`,
        },
        credit: {
          accountCode: 'IC-PAYABLE',
          accountName: `Inter-company Payable to ${entry.fromCompanyName}`,
          amount: entry.totalAmount,
          costCenter: entry.fromCompanyId,
          description: `Inter-company payable for labor provided by ${entry.fromCompanyName} to ${entry.toCompanyName} for payroll period ${run.payrollPeriod}`,
        },
      },
      lineCount: entry.lines.length,
      lines: entry.lines,
    }));

    const summary = {
      totalProposals: jeProposals.length,
      totalAmount: jeProposals.reduce((s, j) => s + j.totalAmount, 0),
      currency: run.currencyCode,
      payrollPeriod: run.payrollPeriod,
      companiesInvolved: new Set(jeProposals.flatMap((j) => [j.fromCompanyId, j.toCompanyId])).size,
    };

    return Response.json({
      data: jeProposals,
      summary,
      homeCompany: { id: homeCompanyId, name: homeCompany?.name },
      payrollRun: { id: run.id, period: run.payrollPeriod, currencyCode: run.currencyCode },
    }, { headers: corsHeaders });
  } catch (error: unknown) {
    console.error('Error in /api/payroll/intercompany GET:', error);
    return Response.json({ error: (error instanceof Error ? error.message : String(error)) }, { status: 500, headers: corsHeaders });
  }
}
