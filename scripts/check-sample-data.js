const { Pool } = require('@neondatabase/serverless');
const pool = new Pool({ connectionString: 'postgresql://neondb_owner:npg_pxZd8woKe4WB@ep-blue-fire-aqk8jxd2-pooler.c-8.us-east-1.aws.neon.tech/neondb?sslmode=require' });

async function main() {
  // Get marqaitechgroup tenant info
  const tenant = await pool.query('SELECT id, name, slug FROM "Tenant" WHERE slug = $1', ['marqaitechgroup']);
  console.log('Tenant:', tenant.rows[0]);
  const tid = tenant.rows[0]?.id;

  if (!tid) {
    console.log('No tenant found');
    await pool.end();
    return;
  }

  // Count users per role
  const users = await pool.query('SELECT u.role, COUNT(*) as cnt FROM "User" u WHERE u."tenantId" = $1 GROUP BY u.role', [tid]);
  console.log('Users by role:', users.rows);

  // Count employees
  const emps = await pool.query('SELECT COUNT(*) as cnt FROM "Employee" e WHERE e."tenantId" = $1', [tid]);
  console.log('Total employees:', emps.rows[0]?.cnt);

  // List non-admin employees
  const nonAdminEmps = await pool.query(
    'SELECT e."employeeId", e."firstName", e."lastName", e.email, u.role FROM "Employee" e LEFT JOIN "User" u ON e."userId" = u.id WHERE e."tenantId" = $1 AND (u.role IS NULL OR u.role NOT IN ($2, $3)) ORDER BY e."employeeId"',
    [tid, 'super_admin', 'tenant_admin']
  );
  console.log('Non-admin employees:', nonAdminEmps.rows.length);
  nonAdminEmps.rows.forEach(r => console.log('  -', r.employeeId, r.firstName, r.lastName, r.email, r.role));

  // List admin employees (to keep)
  const adminEmps = await pool.query(
    'SELECT e."employeeId", e."firstName", e."lastName", e.email, u.role FROM "Employee" e JOIN "User" u ON e."userId" = u.id WHERE e."tenantId" = $1 AND u.role IN ($2, $3) ORDER BY e."employeeId"',
    [tid, 'super_admin', 'tenant_admin']
  );
  console.log('Admin employees (to KEEP):', adminEmps.rows.length);
  adminEmps.rows.forEach(r => console.log('  +', r.employeeId, r.firstName, r.lastName, r.email, r.role));

  // Count user role assignments for this tenant
  const roles = await pool.query(
    'SELECT ura."roleId", r.name, r.key, COUNT(*) as cnt FROM "UserRoleAssignment" ura JOIN "Role" r ON ura."roleId" = r.id JOIN "User" u ON ura."userId" = u.id WHERE u."tenantId" = $1 GROUP BY ura."roleId", r.name, r.key',
    [tid]
  );
  console.log('Role assignments:', roles.rows);

  // List all users for this tenant
  const allUsers = await pool.query(
    'SELECT u.id, u.email, u.name, u.role, u.status FROM "User" u WHERE u."tenantId" = $1 ORDER BY u.role, u.name',
    [tid]
  );
  console.log('All users:', allUsers.rows.length);
  allUsers.rows.forEach(r => console.log('  *', r.email, r.name, r.role, r.status));

  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
