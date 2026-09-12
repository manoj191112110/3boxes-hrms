/**
 * Seed Employee Settings data for the 3Boxes HRMS demo tenant.
 *
 * Fixes three empty tabs on the Employee Settings page:
 *   1. Login Credentials tab – links employees to existing User accounts
 *      (sets Employee.userId where null, matching by email)
 *   2. Invite Employee tab – (data comes from User/Employee links, covered by #1)
 *   3. Map Company tab – creates EmployeeCompanyMapping records for employees
 *      that don't have one
 *
 * Handles duplicate employee emails (same person in multiple companies) by
 * creating separate User accounts with unique email addresses using the
 * plus-addressing convention: original+EMP-XXX@domain.com
 *
 * The script is idempotent (safe to run multiple times).
 *
 * Run:  node /home/z/my-project/scripts/seed-employee-settings-full.js
 */

const { Client } = require('pg');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

// ─── DB config ───────────────────────────────────────────────────────────────
const DB_CONFIG = {
  host: 'ep-blue-fire-aqk8jxd2.c-8.us-east-1.aws.neon.tech',
  database: 'tenant_demo',
  user: 'neondb_owner',
  password: 'npg_pxZd8woKe4WB',
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 30_000,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
function cuid(prefix = 'es') {
  return `${prefix}_${crypto.randomBytes(12).toString('hex')}`;
}

/**
 * Make an email unique by inserting +suffix before the @.
 * e.g. makeUniqueEmail('priya.patel@techcorp.com', 'EMP-052')
 *      => 'priya.patel+EMP-052@techcorp.com'
 */
function makeUniqueEmail(email, suffix) {
  const [local, domain] = email.split('@');
  return `${local}+${suffix}@${domain}`;
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  const client = new Client(DB_CONFIG);
  await client.connect();
  console.log('✅ Connected to tenant_demo database\n');

  // ═══════════════════════════════════════════════════════════════════════
  // STEP 0 — Sanity checks
  // ═══════════════════════════════════════════════════════════════════════
  const tenantRes = await client.query('SELECT id, slug FROM "Tenant" LIMIT 1');
  const tenant = tenantRes.rows[0];
  if (!tenant) {
    console.error('❌ No tenant found in tenant_demo database!');
    process.exit(1);
  }
  console.log(`Tenant: ${tenant.slug} (${tenant.id})\n`);

  const totalEmployees = (await client.query('SELECT COUNT(*)::int AS n FROM "Employee"')).rows[0].n;
  const totalUsers = (await client.query('SELECT COUNT(*)::int AS n FROM "User"')).rows[0].n;
  console.log(`Total employees: ${totalEmployees}`);
  console.log(`Total users:     ${totalUsers}\n`);

  // ═══════════════════════════════════════════════════════════════════════
  // STEP 1 — Link Employees to User accounts (Login Credentials tab)
  // ═══════════════════════════════════════════════════════════════════════
  console.log('━'.repeat(60));
  console.log('STEP 1: Link Employees → Users (Login Credentials tab)');
  console.log('━'.repeat(60));

  // Find employees without a userId
  const unlinkedEmps = await client.query(`
    SELECT e.id, e."employeeId", e.email, e."firstName", e."lastName"
    FROM "Employee" e
    WHERE e."userId" IS NULL
    ORDER BY e."employeeId"
  `);
  console.log(`Employees without userId: ${unlinkedEmps.rows.length}`);

  if (unlinkedEmps.rows.length > 0) {
    // Build a map of all users by email for fast lookup (lowercase keys)
    const allUsers = await client.query('SELECT id, email FROM "User"');
    const userByEmail = new Map(allUsers.rows.map(u => [u.email.toLowerCase(), u.id]));
    console.log(`User emails loaded: ${userByEmail.size}`);

    // Count how many times each email appears among unlinked employees
    // (to detect duplicates and know which ones need a suffix)
    const emailCounts = new Map();
    for (const emp of unlinkedEmps.rows) {
      const key = emp.email.toLowerCase();
      emailCounts.set(key, (emailCounts.get(key) || 0) + 1);
    }
    const duplicateEmails = [...emailCounts.entries()].filter(([, cnt]) => cnt > 1);
    console.log(`Unique emails among unlinked: ${emailCounts.size}`);
    console.log(`Duplicate emails (appearing >1x): ${duplicateEmails.length}\n`);

    let linkedExisting = 0;
    let createdAndLinked = 0;
    let skipped = 0;

    // Pre-compute the bcrypt hash (all users get the same password)
    const passwordHash = bcrypt.hashSync('MarqAI@2026', 12);

    for (const emp of unlinkedEmps.rows) {
      const emailLower = emp.email.toLowerCase();
      const isDuplicate = emailCounts.get(emailLower) > 1;

      // Determine the user email for this employee
      // For duplicates, use plus-addressing to make it unique
      const userEmail = isDuplicate
        ? makeUniqueEmail(emp.email, emp.employeeId)
        : emp.email;
      const userEmailLower = userEmail.toLowerCase();

      // Check if a user already exists with this email
      let userId = userByEmail.get(userEmailLower);

      // If no matching user exists, create one
      if (!userId) {
        try {
          const newUserId = cuid('usr');
          await client.query(
            `INSERT INTO "User" (id, email, password, name, "tenantId", role, status, "createdAt", "updatedAt")
             VALUES ($1, $2, $3, $4, $5, 'employee', 'active', NOW(), NOW())`,
            [newUserId, userEmail, passwordHash, `${emp.firstName} ${emp.lastName}`, tenant.id]
          );
          userId = newUserId;
          userByEmail.set(userEmailLower, newUserId); // Update map for subsequent lookups
          createdAndLinked++;
          if (isDuplicate) {
            console.log(`  🆕 Created User (dup email) ${userEmail} for ${emp.employeeId}`);
          } else {
            console.log(`  🆕 Created User ${userEmail} for ${emp.employeeId}`);
          }
        } catch (err) {
          console.warn(`  ⚠️  Failed to create user for ${emp.employeeId} (${userEmail}): ${err.message}`);
          skipped++;
          continue;
        }
      } else {
        linkedExisting++;
      }

      // Link employee to user
      try {
        await client.query(
          `UPDATE "Employee" SET "userId" = $1, "updatedAt" = NOW() WHERE id = $2 AND "userId" IS NULL`,
          [userId, emp.id]
        );
      } catch (err) {
        console.warn(`  ⚠️  Failed to link ${emp.employeeId} → ${userEmail}: ${err.message}`);
        skipped++;
      }
    }

    console.log(`\n  ✅ Linked to existing users: ${linkedExisting}`);
    console.log(`  🆕 Created new users + linked: ${createdAndLinked}`);
    console.log(`  ⚠️  Skipped/errors: ${skipped}`);
  } else {
    console.log('  All employees already have userId — nothing to do.');
  }

  // ═══════════════════════════════════════════════════════════════════════
  // STEP 2 — Create EmployeeCompanyMapping records (Map Company tab)
  // ═══════════════════════════════════════════════════════════════════════
  console.log('\n' + '━'.repeat(60));
  console.log('STEP 2: Create EmployeeCompanyMapping records (Map Company tab)');
  console.log('━'.repeat(60));

  // Find employees that have a companyId but no EmployeeCompanyMapping
  const unmappedEmps = await client.query(`
    SELECT e.id, e."employeeId", e.email, e."companyId", e."departmentId",
           e."designationId", e."branchId", e."dateOfJoining"
    FROM "Employee" e
    WHERE e."companyId" IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM "EmployeeCompanyMapping" ecm WHERE ecm."employeeId" = e.id
      )
    ORDER BY e."employeeId"
  `);
  console.log(`Employees without mapping (who have companyId): ${unmappedEmps.rows.length}`);

  // Also find employees without any companyId — they still need a mapping
  const noCompanyEmps = await client.query(`
    SELECT e.id, e."employeeId", e.email, e."companyId", e."departmentId",
           e."designationId", e."branchId", e."dateOfJoining"
    FROM "Employee" e
    WHERE e."companyId" IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM "EmployeeCompanyMapping" ecm WHERE ecm."employeeId" = e.id
      )
    ORDER BY e."employeeId"
  `);
  console.log(`Employees without mapping (no companyId): ${noCompanyEmps.rows.length}`);

  if (noCompanyEmps.rows.length > 0) {
    // Try to find a default company for employees without companyId
    const firstCompany = await client.query('SELECT id FROM "Company" ORDER BY "createdAt" LIMIT 1');
    const fallbackCompanyId = firstCompany.rows[0]?.id;
    if (fallbackCompanyId) {
      console.log(`Fallback company ID for employees without companyId: ${fallbackCompanyId}`);
      // Also update the Employee records themselves
      let fixedCompanyId = 0;
      for (const emp of noCompanyEmps.rows) {
        try {
          await client.query(
            `UPDATE "Employee" SET "companyId" = $1, "updatedAt" = NOW() WHERE id = $2 AND "companyId" IS NULL`,
            [fallbackCompanyId, emp.id]
          );
          emp.companyId = fallbackCompanyId;
          fixedCompanyId++;
        } catch (err) {
          console.warn(`  ⚠️  Failed to set companyId for ${emp.employeeId}: ${err.message}`);
        }
      }
      console.log(`  Set companyId on ${fixedCompanyId} employees that had none.`);
    }
  }

  // Combine both lists for mapping creation
  const allUnmapped = [...unmappedEmps.rows, ...noCompanyEmps.rows].filter(e => e.companyId);

  if (allUnmapped.length > 0) {
    let mappingCreated = 0;
    let mappingSkipped = 0;

    for (const emp of allUnmapped) {
      // Double-check idempotency: skip if mapping already exists
      const existing = await client.query(
        `SELECT id FROM "EmployeeCompanyMapping" WHERE "employeeId" = $1 AND "companyId" = $2`,
        [emp.id, emp.companyId]
      );
      if (existing.rows.length > 0) {
        mappingSkipped++;
        continue;
      }

      try {
        await client.query(
          `INSERT INTO "EmployeeCompanyMapping"
             (id, "employeeId", "companyId", "employeeCode", "departmentId", "designationId", "branchId",
              "isPrimary", status, "dateOfJoining", "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, $5, $6, $7, true, 'active', $8, NOW(), NOW())`,
          [
            cuid('ecm'),
            emp.id,
            emp.companyId,
            emp.employeeId,     // employeeCode = employeeId for the primary mapping
            emp.departmentId,
            emp.designationId,
            emp.branchId,
            emp.dateOfJoining || new Date(),
          ]
        );
        mappingCreated++;
      } catch (err) {
        console.warn(`  ⚠️  Mapping for ${emp.employeeId} → company ${emp.companyId} failed: ${err.message}`);
        mappingSkipped++;
      }
    }

    console.log(`\n  ✅ Created: ${mappingCreated}`);
    console.log(`  ⏭️  Skipped (already exists): ${mappingSkipped}`);
  } else {
    console.log('  All employees already have company mappings — nothing to do.');
  }

  // ═══════════════════════════════════════════════════════════════════════
  // STEP 3 — Summary / Verification
  // ═══════════════════════════════════════════════════════════════════════
  console.log('\n' + '━'.repeat(60));
  console.log('STEP 3: Verification');
  console.log('━'.repeat(60));

  const linkedNow = (await client.query(
    `SELECT COUNT(*)::int AS n FROM "Employee" WHERE "userId" IS NOT NULL`
  )).rows[0].n;
  const stillUnlinked = (await client.query(
    `SELECT COUNT(*)::int AS n FROM "Employee" WHERE "userId" IS NULL`
  )).rows[0].n;
  const mappingsNow = (await client.query(
    `SELECT COUNT(*)::int AS n FROM "EmployeeCompanyMapping"`
  )).rows[0].n;
  const empsWithMapping = (await client.query(
    `SELECT COUNT(DISTINCT "employeeId")::int AS n FROM "EmployeeCompanyMapping"`
  )).rows[0].n;
  const empsWithoutMapping = (await client.query(
    `SELECT COUNT(*)::int AS n FROM "Employee" e WHERE NOT EXISTS (SELECT 1 FROM "EmployeeCompanyMapping" ecm WHERE ecm."employeeId" = e.id)`
  )).rows[0].n;
  const totalUsersNow = (await client.query('SELECT COUNT(*)::int AS n FROM "User"')).rows[0].n;

  console.log(`Total users now:              ${totalUsersNow}`);
  console.log(`Employees with userId:        ${linkedNow} / ${totalEmployees}`);
  console.log(`Employees without userId:     ${stillUnlinked}`);
  console.log(`EmployeeCompanyMappings:      ${mappingsNow}`);
  console.log(`Employees with mapping:       ${empsWithMapping}`);
  console.log(`Employees without mapping:    ${empsWithoutMapping}`);

  if (stillUnlinked === 0 && empsWithoutMapping === 0) {
    console.log('\n🎉 All employees are fully set up with login credentials and company mappings!');
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Done
  // ═══════════════════════════════════════════════════════════════════════
  await client.end();
  console.log('\n✅ Done! Employee settings data seeded successfully.');
}

main().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
