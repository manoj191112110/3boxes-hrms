import { NextResponse } from 'next/server';

/**
 * GET /api/trial/excel-template
 * Downloads a CSV template for sample employee data upload.
 */
export async function GET() {
  const csvContent = `EmployeeId,FirstName,LastName,Email,Phone,Department,Designation,DateOfJoining
EMP-001,John,Doe,john@company.com,+91 98765 43210,Engineering,Software Engineer,2024-01-15
EMP-002,Jane,Smith,jane@company.com,+91 98765 43211,Human Resources,HR Manager,2024-02-01
EMP-003,Raj,Kumar,raj@company.com,+91 98765 43212,Finance,Accountant,2024-03-10
EMP-004,Priya,Sharma,priya@company.com,+91 98765 43213,Operations,Operations Lead,2024-04-20
EMP-005,Amit,Patel,amit@company.com,+91 98765 43214,Marketing,Marketing Specialist,2024-05-05`;

  const headers = new Headers();
  headers.set('Content-Type', 'text/csv');
  headers.set('Content-Disposition', 'attachment; filename="3boxes_hrms_sample_employees.csv"');

  return new NextResponse(csvContent, { headers });
}
