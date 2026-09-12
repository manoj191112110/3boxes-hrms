#!/usr/bin/env python3
"""
READ-ONLY diagnosis round 4: simulate the EXACT app flow for
marqaitechgroup.3boxeshrms.com/employees/dashboard.

The app (Vercel) does:
  1. middleware sets x-tenant-slug=marqaitechgroup
  2. getDb -> getDbForTenant('marqaitechgroup')
     -> platform DB query: TenantDatabase WHERE tenant.slug=slug AND isActive=true
     -> connects via the STORED connectionString (PrismaNeon)
  3. employee.findMany({ where ... })  -> pagination.total drives the UI count

This script verifies EVERY step of that chain READ-ONLY:
  A. Tenant row: id, slug, status (suspended tenants are blocked elsewhere)
  B. ALL TenantDatabase rows for the slug (multiple rows? inactive? stale URL?)
  C. LIVE CONNECTION TEST using the exact stored connectionString
  D. Employee count through that connection = what the API would return
  E. User roles in tenant DB (who logs in, role values -> scope mapping)
  F. Admin user's Employee record (scope resolution for the logged-in admin)
  G. Per-company employee counts (company switcher impact)
  H. Recent AuditLog entries
NEVER writes anything.
"""
import psycopg2

HOST = "ep-blue-fire-aqk8jxd2.c-8.us-east-1.aws.neon.tech"
USER = "neondb_owner"
PASS = "npg_pxZd8woKe4WB"


def get_conn(dbname):
    return psycopg2.connect(
        f"postgresql://{USER}:{PASS}@{HOST}/{dbname}?sslmode=require&connect_timeout=30"
    )


def q(cur, sql, label, show=25):
    print(f"\n--- {label} ---")
    try:
        cur.execute(sql)
        if cur.description:
            rows = cur.fetchall()
            cols = [d[0] for d in cur.description]
            print(f"({len(rows)} rows) {cols}")
            for r in rows[:show]:
                print("  ", r)
            return rows
    except Exception as e:
        print(f"ERROR: {e}")
    return []


print("=" * 78)
print("STEP A/B: PLATFORM DB — Tenant + TenantDatabase records (exact app lookup)")
print("=" * 78)
conn = get_conn("neondb")
conn.autocommit = True
cur = conn.cursor()

tenant_rows = q(cur, """SELECT id, slug, name, status, "createdAt"
                        FROM "Tenant" WHERE slug = 'marqaitechgroup'""",
                "Tenant row for marqaitechgroup")
tenant_id = tenant_rows[0][0] if tenant_rows else None
print(f"  -> tenantId = {tenant_id}")

q(cur, """SELECT td.id, td."databaseName", td."isActive", td."createdAt", td."updatedAt",
                 LENGTH(td."connectionString") AS cs_len,
                 LEFT(td."connectionString", 24) AS cs_prefix
          FROM "TenantDatabase" td
          WHERE td."tenantId" = %s
          ORDER BY td."createdAt" """ % (f"'{tenant_id}'" if tenant_id else "NULL"),
        "ALL TenantDatabase rows for marqaitechgroup (app uses findFirst isActive=true)")

# Get the FULL connection string for the live test (same findFirst order Prisma uses)
cur.execute("""SELECT td."connectionString", td."databaseName"
               FROM "TenantDatabase" td
               JOIN "Tenant" t ON t.id = td."tenantId"
               WHERE t.slug = 'marqaitechgroup' AND td."isActive" = true""")
row = cur.fetchone()
conn.close()

stored_cs = None
stored_db = None
if row:
    stored_cs, stored_db = row[0], row[1]
    masked = stored_cs
    if "@" in stored_cs and "://" in stored_cs:
        try:
            scheme_rest = stored_cs.split("://", 1)[1]
            creds, hostpart = scheme_rest.split("@", 1)
            pw = creds.split(":", 1)[1] if ":" in creds else "***"
            masked = stored_cs.split("://")[0] + "://***:" + pw[:3] + "***@" + hostpart
        except Exception:
            pass
    print(f"\n  STORED ACTIVE CONNECTION (what the app uses): {masked}")
    print(f"  databaseName column says: {stored_db}")
else:
    print("\n  !! NO ACTIVE TenantDatabase ROW — app falls back to PLATFORM DB (which has no tenant employees) !!")

print("\n" + "=" * 78)
print("STEP C/D: LIVE CONNECTION TEST via the STORED connectionString (as PrismaNeon does)")
print("=" * 78)
if stored_cs:
    try:
        tconn = psycopg2.connect(stored_cs + ("&connect_timeout=30" if "?" in stored_cs else "?sslmode=require&connect_timeout=30"))
        tconn.autocommit = True
        tcur = tconn.cursor()
        tcur.execute('SELECT COUNT(*) FROM "Employee"')
        print(f"  CONNECTED OK via stored CS — Employee count = {tcur.fetchone()[0]}")
        tcur.execute("""SELECT c.name, COUNT(e.id) FROM "Employee" e
                        LEFT JOIN "Company" c ON c.id = e."companyId"
                        GROUP BY c.name ORDER BY COUNT(e.id) DESC""")
        print("  Per-company counts via stored CS:", tcur.fetchall())
        tcur.execute("""SELECT u.role, COUNT(*) FROM "User" u GROUP BY u.role ORDER BY 2 DESC""")
        print("  User roles:", tcur.fetchall())
        tcur.execute('SELECT COUNT(*) FROM "Company"')
        print(f"  Company count via stored CS = {tcur.fetchone()[0]}")
        tconn.close()
    except Exception as e:
        print(f"  !! STORED CONNECTION STRING FAILED: {type(e).__name__}: {e}")
        print("  !! If this fails, the app gets connection errors -> API 5xx -> UI shows 0")
else:
    # App would use platform DB — count what IT would return
    print("  App fallback path: platform DB employee count:")
    conn = get_conn("neondb")
    cur = conn.cursor()
    cur.execute('SELECT COUNT(*) FROM "Employee"')
    print(f"  platform DB Employee count = {cur.fetchone()[0]}")
    conn.close()

print("\n" + "=" * 78)
print("STEP E/F: TENANT DB — users, admin employee record (scope resolution)")
print("=" * 78)
conn = get_conn("tenant_marqaitechgroup")
conn.autocommit = True
cur = conn.cursor()
q(cur, """SELECT u.id, u.email, u.role, u."isActive", u.status
          FROM "User" u ORDER BY u."createdAt" LIMIT 20""",
        "Users in tenant DB (role drives JWT -> scope)")
q(cur, """SELECT e."employeeId", e.email, e.status, u.email AS user_email, u.role
          FROM "Employee" e LEFT JOIN "User" u ON u.id = e."userId"
          WHERE u.role IN ('tenant_admin','admin','super_admin','hr_admin')""",
        "Admin-linked employee records (resolveCompanyScope uses userId+status='active')")
q(cur, 'SELECT status, COUNT(*) FROM "Employee" GROUP BY status', "Employee status breakdown")
q(cur, """SELECT "action", "entity", COUNT(*) FROM "AuditLog"
          WHERE "createdAt" > NOW() - INTERVAL '2 days'
          GROUP BY "action", "entity" ORDER BY 3 DESC LIMIT 20""",
        "AuditLog last 2 days")
q(cur, """SELECT MAX("updatedAt") FROM "Employee" """, "Latest employee updatedAt")
conn.close()
print("\nDONE — READ-ONLY, nothing was modified.")
