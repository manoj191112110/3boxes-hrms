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

export async function GET(request: NextRequest) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    const decoded = await verifyToken(token);
    if (!decoded) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });

    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    const status = searchParams.get('status');
    const fileFormat = searchParams.get('fileFormat');
    const payrollRunId = searchParams.get('payrollRunId');

    const where: Record<string, unknown> = {};
    if (companyId) where.companyId = companyId;
    if (status) where.status = status;
    if (fileFormat) where.fileFormat = fileFormat;
    if (payrollRunId) where.payrollRunId = payrollRunId;

    try {
      const data = await db.bankPaymentFile.findMany({
        where,
        orderBy: { createdAt: 'desc' },
      });

      return Response.json({ data }, { headers: corsHeaders });
    } catch (dbError: unknown) {
      console.error('Database error fetching bank files:', dbError);
      return Response.json({ data: [] }, { headers: corsHeaders });
    }
  } catch (error: unknown) {
    console.error('Error fetching bank files:', error);
    return Response.json({ error: (error instanceof Error ? error.message : String(error)) }, { status: 500, headers: corsHeaders });
  }
}

export async function POST(request: NextRequest) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    const decoded = await verifyToken(token);
    if (!decoded) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });

    const body = await request.json();
    const { payrollRunId, fileFormat = 'NACH', bankCode, companyId } = body;

    if (!payrollRunId) {
      return Response.json({ error: 'payrollRunId is required' }, { status: 400, headers: corsHeaders });
    }

    // Fetch the payroll run
    let payrollRun;
    try {
      payrollRun = await db.payrollRun.findUnique({
        where: { id: payrollRunId },
      });
    } catch (dbError: unknown) {
      console.error('Database error fetching payroll run:', dbError);
      return Response.json({ error: 'Service temporarily unavailable' }, { status: 503, headers: corsHeaders });
    }
    if (!payrollRun) {
      return Response.json({ error: 'Payroll run not found' }, { status: 404, headers: corsHeaders });
    }

    // Fetch all transaction lines for net pay (EARNING - DEDUCTION per employee)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let transactionLines: any[] = [];
    try {
      transactionLines = await db.payrollTransactionLine.findMany({
        where: {
          payrollRunId,
          isReversal: false,
        },
        include: {
          component: { select: { code: true, name: true, componentType: true } },
        },
      });
    } catch (dbError: unknown) {
      console.error('Database error fetching transaction lines:', dbError);
      return Response.json({ error: 'Service temporarily unavailable' }, { status: 503, headers: corsHeaders });
    }

    // Group by employee to calculate net pay
    const employeeMap: Record<string, {
      gross: number;
      deductions: number;
      employerContrib: number;
      net: number;
      currencyCode: string;
    }> = {};

    for (const line of transactionLines) {
      if (!employeeMap[line.employeeId]) {
        employeeMap[line.employeeId] = { gross: 0, deductions: 0, employerContrib: 0, net: 0, currencyCode: line.currencyCode };
      }
      if (line.componentType === 'EARNING') {
        employeeMap[line.employeeId].gross += line.finalAmount;
      } else if (line.componentType === 'DEDUCTION') {
        employeeMap[line.employeeId].deductions += line.finalAmount;
      } else if (line.componentType === 'EMPLOYER_CONTRIB') {
        employeeMap[line.employeeId].employerContrib += line.finalAmount;
      }
    }

    // Calculate net pay per employee
    for (const emp of Object.values(employeeMap)) {
      emp.net = emp.gross - emp.deductions;
    }

    // Get employee bank details
    const employeeIds = Object.keys(employeeMap);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let employees: any[] = [];
    try {
      employees = await db.employee.findMany({
        where: { id: { in: employeeIds } },
        include: {
          employeePaymentMethods: {
            where: { status: 'active', paymentType: 'DIRECT_DEPOSIT' },
            orderBy: { priority: 'asc' },
          },
        },
      });
    } catch (dbError: unknown) {
      console.error('Database error fetching employees for bank file:', dbError);
      return Response.json({ error: 'Service temporarily unavailable' }, { status: 503, headers: corsHeaders });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const employeeLookup: Record<string, any> = {};
    for (const emp of employees) {
      employeeLookup[emp.id] = emp;
    }

    // Generate file content based on format
    let fileContent = '';
    const format = (fileFormat || 'NACH').toUpperCase();
    let totalAmount = 0;
    let totalRecords = 0;
    const fileRecords: Record<string, unknown>[] = [];

    if (format === 'NACH') {
      // NACH (National Automated Clearing House) format
      // Header record
      const headerRecord = {
        recordType: 'HDR',
        fileRefNo: `NACH${Date.now()}`,
        date: new Date().toISOString().split('T')[0].replace(/-/g, ''),
        bankCode: bankCode || 'NACH',
        companyId: companyId || payrollRun.legalEntityId,
      };

      // Detail records
      for (const [empId, payData] of Object.entries(employeeMap)) {
        const emp = employeeLookup[empId];
        if (!emp || payData.net <= 0) continue;

        // Get primary payment method or fall back to employee bank details
        const paymentMethod = emp.employeePaymentMethods?.[0];
        const bankAccountNo = paymentMethod?.bankAccountNo || emp.bankAccountNo;
        const bankIfscCode = paymentMethod?.bankIfscCode || emp.bankIfscCode;
        const bankName = paymentMethod?.bankName || emp.bankName;

        if (!bankAccountNo || !bankIfscCode) continue;

        totalAmount += payData.net;
        totalRecords++;

        fileRecords.push({
          recordType: 'DTL',
          employeeId: emp.employeeId,
          employeeName: `${emp.firstName} ${emp.lastName}`,
          bankAccountNo,
          bankIfscCode,
          bankName: bankName || 'UNKNOWN',
          amount: payData.net.toFixed(2),
          currencyCode: payData.currencyCode,
        });
      }

      fileContent = JSON.stringify({ header: headerRecord, records: fileRecords, trailer: { recordType: 'TRL', totalRecords, totalAmount: totalAmount.toFixed(2) } }, null, 2);

    } else if (format === 'NEFT') {
      // NEFT format
      for (const [empId, payData] of Object.entries(employeeMap)) {
        const emp = employeeLookup[empId];
        if (!emp || payData.net <= 0) continue;

        const paymentMethod = emp.employeePaymentMethods?.[0];
        const bankAccountNo = paymentMethod?.bankAccountNo || emp.bankAccountNo;
        const bankIfscCode = paymentMethod?.bankIfscCode || emp.bankIfscCode;
        const bankName = paymentMethod?.bankName || emp.bankName;

        if (!bankAccountNo || !bankIfscCode) continue;

        totalAmount += payData.net;
        totalRecords++;

        fileRecords.push({
          beneficiaryName: `${emp.firstName} ${emp.lastName}`,
          beneficiaryAccountNo: bankAccountNo,
          ifscCode: bankIfscCode,
          bankName: bankName || 'UNKNOWN',
          amount: payData.net.toFixed(2),
          paymentReference: `SAL${payrollRun.payrollPeriod}${emp.employeeId}`,
          remitterReference: payrollRun.legalEntityId,
          remarks: `Salary for ${payrollRun.payrollPeriod}`,
        });
      }

      fileContent = JSON.stringify({
        format: 'NEFT',
        payrollPeriod: payrollRun.payrollPeriod,
        records: fileRecords,
        summary: { totalRecords, totalAmount: totalAmount.toFixed(2) },
      }, null, 2);

    } else {
      // CUSTOM format — CSV-like
      for (const [empId, payData] of Object.entries(employeeMap)) {
        const emp = employeeLookup[empId];
        if (!emp || payData.net <= 0) continue;

        const paymentMethod = emp.employeePaymentMethods?.[0];
        const bankAccountNo = paymentMethod?.bankAccountNo || emp.bankAccountNo;
        const bankIfscCode = paymentMethod?.bankIfscCode || emp.bankIfscCode;
        const bankName = paymentMethod?.bankName || emp.bankName;

        if (!bankAccountNo || !bankIfscCode) continue;

        totalAmount += payData.net;
        totalRecords++;

        fileRecords.push({
          employeeId: emp.employeeId,
          name: `${emp.firstName} ${emp.lastName}`,
          bankAccountNo,
          ifscCode: bankIfscCode,
          bankName: bankName || 'UNKNOWN',
          netPay: payData.net.toFixed(2),
          currency: payData.currencyCode,
        });
      }

      fileContent = JSON.stringify({
        format: 'CUSTOM',
        payrollPeriod: payrollRun.payrollPeriod,
        records: fileRecords,
        summary: { totalRecords, totalAmount: totalAmount.toFixed(2) },
      }, null, 2);
    }

    // Create the bank payment file record
    const fileName = `${format}_${payrollRun.payrollPeriod}_${new Date().toISOString().split('T')[0]}.json`;
    try {
      const bankFile = await db.bankPaymentFile.create({
        data: {
          payrollRunId,
          fileName,
          fileFormat: format,
          bankCode: bankCode || null,
          totalAmount,
          totalRecords,
          fileContent,
          generatedBy: decoded.userId as string,
          status: 'generated',
          companyId: companyId || null,
        },
      });

      return Response.json({
        data: bankFile,
        message: `Bank file generated successfully — ${totalRecords} records, total ${totalAmount.toFixed(2)}`,
      }, { headers: corsHeaders });
    } catch (dbError: unknown) {
      console.error('Database error creating bank payment file:', dbError);
      return Response.json({ error: 'Service temporarily unavailable' }, { status: 503, headers: corsHeaders });
    }
  } catch (error: unknown) {
    console.error('Error generating bank file:', error);
    return Response.json({ error: (error instanceof Error ? error.message : String(error)) }, { status: 500, headers: corsHeaders });
  }
}
