/**
 * Create 4 company HR admin accounts for MarqAI Tech Group
 */
const { Client } = require('pg');
const crypto = require('crypto');

function generateId() {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomBytes(8).toString('hex').substring(0, 20);
  return 'cmr' + timestamp + random;
}

const PASSWORD_HASH = '$2b$12$00JNWyMIUr9f0YeSwpEQPOb9ff3Mxxs2aBvCiPUmlpZJUhM5hHZtm'; // MarqAI@2026

const COMPANY_ADMINS = [
  { email: 'admin@marqaitech.com', name: 'Admin - MARQ AI TECH', firstName: 'Admin', lastName: 'MARQ AI TECH', companyCode: 'MATPL' },
  { email: 'admin@3boxesluxury.com', name: 'Admin - 3 BOXES LUXURY', firstName: 'Admin', lastName: '3 BOXES LUXURY', companyCode: '3BLC' },
  { email: 'admin@3boxesconsulting.com', name: 'Admin - 3 BOXES CONSULTING', firstName: 'Admin', lastName: '3 BOXES CONSULTING', companyCode: '3BCS' },
  { email: 'admin@3boxestechnologies.com', name: 'Admin - 3 BOXES TECH', firstName: 'Admin', lastName: '3 BOXES TECH', companyCode: '3BT' },
];

const CONNECTION_STRING = 'postgresql://neondb_owner:npg_pxZd8woKe4WB@ep-blue-fire-aqk8jxd2-pooler.c-8.us-east-1.aws.neon.tech/neondb?uselibpqcompat=true&sslmode=require';

async function main() {
  const client = new Client({ connectionString: CONNECTION_STRING });
  await client.connect();
  
  try {
    await client.query('BEGIN');
    
    const tenant = await client.query(`SELECT id FROM "Tenant" WHERE slug = 'marqaitechgroup'`);
    const tenantId = tenant.rows[0].id;
    
    const companies = await client.query(
      `SELECT id, name, code FROM "Company" WHERE "companyGroupId" IN (SELECT id FROM "CompanyGroup" WHERE "tenantId" = $1) ORDER BY "createdAt"`,
      [tenantId]
    );
    
    for (const admin of COMPANY_ADMINS) {
      const company = companies.rows.find(c => c.code === admin.companyCode);
      if (!company) { console.log('Company not found:', admin.companyCode); continue; }
      
      // Check existing user
      const existing = await client.query(`SELECT id FROM "User" WHERE email = $1`, [admin.email]);
      let userId;
      
      if (existing.rows.length > 0) {
        userId = existing.rows[0].id;
        await client.query(`UPDATE "User" SET password = $1, "tenantId" = $2, role = 'company_hr_admin', name = $3 WHERE id = $4`, 
          [PASSWORD_HASH, tenantId, admin.name, userId]);
        console.log('Updated user:', admin.email);
      } else {
        userId = generateId();
        await client.query(
          `INSERT INTO "User" (id, email, name, password, role, status, "tenantId", "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, 'company_hr_admin', 'active', $5, NOW(), NOW())`,
          [userId, admin.email, admin.name, PASSWORD_HASH, tenantId]
        );
        console.log('Created user:', admin.email);
      }
      
      // Get branch, dept, designation
      const branch = await client.query(`SELECT id FROM "Branch" WHERE "companyId" = $1 LIMIT 1`, [company.id]);
      const dept = await client.query(`SELECT id FROM "Department" WHERE "companyId" = $1 AND name = 'Human Resources' LIMIT 1`, [company.id]);
      const des = await client.query(
        `SELECT d.id FROM "Designation" d JOIN "Department" dept ON d."departmentId" = dept.id WHERE dept."companyId" = $1 AND d.title = 'HR Manager' LIMIT 1`,
        [company.id]
      );
      
      // Create employee record
      const existingEmp = await client.query(`SELECT id FROM "Employee" WHERE "userId" = $1`, [userId]);
      if (existingEmp.rows.length === 0 && branch.rows[0] && dept.rows[0] && des.rows[0]) {
        const empId = generateId();
        const employeeCode = 'ADM-' + admin.companyCode + '-001';
        await client.query(
          `INSERT INTO "Employee" (id, "userId", "companyId", "branchId", "departmentId", "designationId", "employeeId", "firstName", "lastName", email, status, "dateOfJoining", "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'active', NOW(), NOW(), NOW())`,
          [empId, userId, company.id, branch.rows[0].id, dept.rows[0].id, des.rows[0].id, employeeCode, admin.firstName, admin.lastName, admin.email]
        );
        console.log('Created employee for:', admin.email, '->', company.name);
      } else if (existingEmp.rows.length > 0) {
        // Update existing employee to point to correct company
        await client.query(
          `UPDATE "Employee" SET "companyId" = $1, "branchId" = $2, "departmentId" = $3, "designationId" = $4, "employeeId" = $5, "firstName" = $6, "lastName" = $7, email = $8 WHERE "userId" = $9`,
          [company.id, branch.rows[0]?.id, dept.rows[0]?.id, des.rows[0]?.id, 'ADM-' + admin.companyCode + '-001', admin.firstName, admin.lastName, admin.email, userId]
        );
        console.log('Updated employee for:', admin.email, '->', company.name);
      } else {
        console.log('Missing refs for:', admin.email, 'branch:', !!branch.rows[0], 'dept:', !!dept.rows[0], 'des:', !!des.rows[0]);
      }
    }
    
    await client.query('COMMIT');
    console.log('\n✅ All company admins created!');
    
    // Verify
    const users = await client.query(`SELECT email, role, name FROM "User" WHERE "tenantId" = $1 ORDER BY role, email`, [tenantId]);
    console.log('\nAll MarqAI users:');
    users.rows.forEach(u => console.log('  -', u.email, '|', u.role, '|', u.name));
    
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('❌ Error:', e.message);
  } finally {
    await client.end();
  }
}

main();
