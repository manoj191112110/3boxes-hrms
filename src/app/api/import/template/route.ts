import { NextRequest, NextResponse } from 'next/server';
import * as xlsx from 'xlsx';

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

// ── Module template definitions ────────────────────────────────────────────

interface TemplateColumn {
  header: string;
  key: string;
  required: boolean;
  type: string;
  description: string;
  example: string;
}

const MODULE_TEMPLATES: Record<string, TemplateColumn[]> = {
  employees: [
    { header: 'Employee ID', key: 'employeeId', required: true, type: 'Text', description: 'Unique employee identifier (e.g., EMP001)', example: 'EMP001' },
    { header: 'First Name', key: 'firstName', required: true, type: 'Text', description: 'Employee first name', example: 'John' },
    { header: 'Last Name', key: 'lastName', required: true, type: 'Text', description: 'Employee last name', example: 'Doe' },
    { header: 'Email', key: 'email', required: true, type: 'Email', description: 'Work email address (must be unique)', example: 'john.doe@company.com' },
    { header: 'Phone', key: 'phone', required: false, type: 'Text', description: 'Phone number with country code', example: '+91 9876543210' },
    { header: 'Date of Joining', key: 'dateOfJoining', required: false, type: 'Date', description: 'Joining date in YYYY-MM-DD format', example: '2024-01-15' },
    { header: 'Date of Birth', key: 'dateOfBirth', required: false, type: 'Date', description: 'Birth date in YYYY-MM-DD format', example: '1990-05-20' },
    { header: 'Gender', key: 'gender', required: false, type: 'Text', description: 'Male, Female, or Other', example: 'Male' },
    { header: 'Marital Status', key: 'maritalStatus', required: false, type: 'Text', description: 'Marital status (Single, Married, etc.)', example: 'Single' },
    { header: 'Nationality', key: 'nationality', required: false, type: 'Text', description: 'Nationality', example: 'Indian' },
    { header: 'Address', key: 'address', required: false, type: 'Text', description: 'Street address', example: '123 Main St' },
    { header: 'City', key: 'city', required: false, type: 'Text', description: 'City name', example: 'Mumbai' },
    { header: 'State', key: 'state', required: false, type: 'Text', description: 'State or province', example: 'Maharashtra' },
    { header: 'Zip Code', key: 'zipCode', required: false, type: 'Text', description: 'Postal / ZIP code', example: '400001' },
    { header: 'Country', key: 'country', required: false, type: 'Text', description: 'Country name', example: 'India' },
    { header: 'Blood Group', key: 'bloodGroup', required: false, type: 'Text', description: 'Blood group (A+, B+, O+, etc.)', example: 'O+' },
    { header: 'Bank Name', key: 'bankName', required: false, type: 'Text', description: 'Bank name for salary deposit', example: 'HDFC Bank' },
    { header: 'Bank Account No', key: 'bankAccountNo', required: false, type: 'Text', description: 'Bank account number', example: '12345678901234' },
    { header: 'Bank IFSC Code', key: 'bankIfscCode', required: false, type: 'Text', description: 'Bank IFSC code', example: 'HDFC0001234' },
    { header: 'PAN Number', key: 'panNumber', required: false, type: 'Text', description: 'PAN card number', example: 'ABCDE1234F' },
    { header: 'Aadhaar Number', key: 'aadhaarNumber', required: false, type: 'Text', description: 'Aadhaar card number', example: '123456789012' },
    { header: 'Salary', key: 'salary', required: false, type: 'Number', description: 'Annual CTC / salary amount', example: '600000' },
    { header: 'Salary Currency', key: 'salaryCurrency', required: false, type: 'Text', description: 'Currency code (INR, USD, etc.)', example: 'INR' },
    { header: 'Department Name', key: 'departmentName', required: false, type: 'Lookup', description: 'Existing department name to link to', example: 'Engineering' },
    { header: 'Designation Title', key: 'designationTitle', required: false, type: 'Lookup', description: 'Existing designation title to link to', example: 'Software Engineer' },
    { header: 'Role', key: 'role', required: false, type: 'Text', description: 'System role: employee, manager, hr_admin, finance_admin, travel_admin, crm_admin', example: 'employee' },
  ],
  departments: [
    { header: 'Name', key: 'name', required: true, type: 'Text', description: 'Department name', example: 'Engineering' },
    { header: 'Code', key: 'code', required: true, type: 'Text', description: 'Unique department code', example: 'ENG' },
    { header: 'Company ID', key: 'companyId', required: false, type: 'Text', description: 'Company ID (if known)', example: 'clx123abc' },
    { header: 'Company Name', key: 'companyName', required: false, type: 'Lookup', description: 'Company name to look up (used if Company ID is blank)', example: 'Marq AI Tech Pvt Ltd' },
  ],
  designations: [
    { header: 'Title', key: 'title', required: true, type: 'Text', description: 'Designation title', example: 'Software Engineer' },
    { header: 'Department Name', key: 'departmentName', required: false, type: 'Lookup', description: 'Existing department name to link to', example: 'Engineering' },
    { header: 'Grade', key: 'grade', required: false, type: 'Text', description: 'Grade or band', example: 'E3' },
    { header: 'Level', key: 'level', required: false, type: 'Number', description: 'Numeric level (default 1)', example: '3' },
    { header: 'Min Salary', key: 'minSalary', required: false, type: 'Number', description: 'Minimum salary for this designation', example: '500000' },
    { header: 'Max Salary', key: 'maxSalary', required: false, type: 'Number', description: 'Maximum salary for this designation', example: '900000' },
  ],
  branches: [
    { header: 'Name', key: 'name', required: true, type: 'Text', description: 'Branch name', example: 'Mumbai HQ' },
    { header: 'Code', key: 'code', required: true, type: 'Text', description: 'Unique branch code', example: 'MUM-HQ' },
    { header: 'Company Name', key: 'companyName', required: false, type: 'Lookup', description: 'Company name to look up', example: 'Marq AI Tech Pvt Ltd' },
    { header: 'City', key: 'city', required: false, type: 'Text', description: 'City', example: 'Mumbai' },
    { header: 'State', key: 'state', required: false, type: 'Text', description: 'State or province', example: 'Maharashtra' },
    { header: 'Country', key: 'country', required: false, type: 'Text', description: 'Country', example: 'India' },
    { header: 'Is Head Office', key: 'isHeadOffice', required: false, type: 'Boolean', description: 'true or false', example: 'true' },
  ],
  'leave-types': [
    { header: 'Name', key: 'name', required: true, type: 'Text', description: 'Leave type name', example: 'Casual Leave' },
    { header: 'Code', key: 'code', required: true, type: 'Text', description: 'Unique code for this leave type', example: 'CL' },
    { header: 'Default Days', key: 'defaultDays', required: false, type: 'Number', description: 'Default number of days per year', example: '12' },
    { header: 'Is Paid', key: 'isPaid', required: false, type: 'Boolean', description: 'true for paid, false for unpaid (default true)', example: 'true' },
    { header: 'Carry Forward', key: 'carryForward', required: false, type: 'Boolean', description: 'Allow carry forward? (default false)', example: 'false' },
    { header: 'Max Carry Forward Days', key: 'maxCarryForwardDays', required: false, type: 'Number', description: 'Maximum days that can be carried forward', example: '5' },
  ],
  'salary-structures': [
    { header: 'Name', key: 'name', required: true, type: 'Text', description: 'Salary structure name', example: 'Standard CTC' },
    { header: 'Description', key: 'description', required: false, type: 'Text', description: 'Description of the salary structure', example: 'Standard compensation structure for all employees' },
    { header: 'Is Active', key: 'isActive', required: false, type: 'Boolean', description: 'true or false (default true)', example: 'true' },
  ],
};

const VALID_MODULES = Object.keys(MODULE_TEMPLATES);

// ── GET handler ────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const templateModule = searchParams.get('module');

    if (!templateModule || !VALID_MODULES.includes(templateModule)) {
      return NextResponse.json(
        { error: `Invalid module. Must be one of: ${VALID_MODULES.join(', ')}` },
        { status: 400, headers: corsHeaders() }
      );
    }

    const columns = MODULE_TEMPLATES[templateModule];

    // ── Create workbook ──
    const wb = xlsx.utils.book_new();

    // ── Sheet 1: Template with headers and example row ──
    const templateHeaders = columns.map(c => c.header);
    const exampleRow = columns.map(c => c.example);
    const templateData = [templateHeaders, exampleRow];
    const ws1 = xlsx.utils.aoa_to_sheet(templateData);

    // Set column widths
    ws1['!cols'] = columns.map(c => ({
      wch: Math.max(c.header.length + 4, c.example.length + 2, 16),
    }));

    xlsx.utils.book_append_sheet(wb, ws1, 'Template');

    // ── Sheet 2: Instructions ──
    const instructionHeaders = ['Column', 'Key', 'Required', 'Type', 'Description', 'Example'];
    const instructionRows = columns.map(c => [
      c.header,
      c.key,
      c.required ? 'Yes' : 'No',
      c.type,
      c.description,
      c.example,
    ]);

    const ws2Data: unknown[][] = [
      ['BULK IMPORT INSTRUCTIONS'],
      [''],
      ['Module:', templateModule],
      [''],
      ['Required columns must have values in every row.'],
      ['Dates should be in YYYY-MM-DD format.'],
      ['Boolean values: use true/false, yes/no, or 1/0.'],
      ['Lookup columns (Department Name, Company Name, etc.) must match existing records in the system.'],
      ['Rows with validation errors will be skipped; others will still be imported.'],
      [''],
      instructionHeaders,
      ...instructionRows,
    ];

    const ws2 = xlsx.utils.aoa_to_sheet(ws2Data);
    ws2['!cols'] = [
      { wch: 28 }, // Column
      { wch: 22 }, // Key
      { wch: 10 }, // Required
      { wch: 10 }, // Type
      { wch: 60 }, // Description
      { wch: 30 }, // Example
    ];

    xlsx.utils.book_append_sheet(wb, ws2, 'Instructions');

    // ── Generate buffer ──
    const buf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

    // ── Return file ──
    const fileName = `${templateModule}-import-template.xlsx`;
    return new NextResponse(buf, {
      status: 200,
      headers: {
        ...corsHeaders(),
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    });
  } catch (error: unknown) {
    console.error('[Import Template] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500, headers: corsHeaders() });
  }
}
