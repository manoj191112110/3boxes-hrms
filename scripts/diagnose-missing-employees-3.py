#!/usr/bin/env python3
"""
READ-ONLY diagnosis round 3: stale companyId hypothesis.
If Employee.companyId (admin's own record) points to a company that no longer
exists in tenant_marqaitechgroup, the company-scoped queries return ZERO.
"""
import psycopg2

HOST = "ep-blue-fire-aqk8jxd2.c-8.us-east-1.aws.neon.tech"
USER = "neondb_owner"
PASS = "npg_pxZd8woKe4WB"


def get_conn(dbname):
    return psycopg2.connect(f"postgresql://{USER}:{PASS}@{HOST}/{dbname}?sslmode=require&connect_timeout=30")


def q(cur, sql, label):
    print(f"\n--- {label} ---")
    try:
        cur.execute(sql)
        if cur.description:
            rows = cur.fetchall()
            cols = [d[0] for d in cur.description]
            print(f"({len(rows)} rows) {cols}")
            for r in rows[:25]:
                print("  ", r)
    except Exception as e:
        print(f"ERROR: {e}")


conn = get_conn("tenant_marqaitechgroup")
conn.autocommit = True
cur = conn.cursor()

print("=" * 70)
print("TENANT DB: tenant_marqaitechgroup — company linkage")
print("=" * 70)

q(cur, 'SELECT id, code, name, status FROM "Company" ORDER BY "createdAt"', "ALL companies (with IDs)")
q(cur, '''SELECT e."employeeId", e."firstName", e."lastName", e."email",
                 e."companyId", c.name AS "companyName",
                 (e."companyId" IS NOT NULL AND c.id IS NULL) AS "STALE companyId"
          FROM "Employee" e
          LEFT JOIN "Company" c ON c.id = e."companyId"
          ORDER BY e."createdAt" DESC''',
      "Employees + their company linkage (STALE = companyId points to missing company)")
q(cur, '''SELECT m."employeeId", m."companyId", m."isPrimary", c.name
          FROM "EmployeeCompanyMapping" m
          LEFT JOIN "Company" c ON c.id = m."companyId"
          ORDER BY m."employeeId" LIMIT 15''',
      "EmployeeCompanyMapping + company names")
q(cur, 'SELECT COUNT(*) FROM "Employee" WHERE "companyId" IS NULL', "Employees with NULL companyId")
q(cur, '''SELECT e."employeeId", e."email", u.id AS "userId", u.email AS "userEmail", u.role
          FROM "Employee" e LEFT JOIN "User" u ON u.id = e."userId"''',
      "Employee → User links (admin record?)")

conn.close()

# Also check the platform DB copy of employees (duplicates from force-fix era)
conn = get_conn("neondb")
conn.autocommit = True
cur = conn.cursor()
print("\n" + "=" * 70)
print("PLATFORM DB (neondb): employee copies")
print("=" * 70)
q(cur, '''SELECT e."employeeId", e."firstName", e."email", c.name AS "companyName"
          FROM "Employee" e LEFT JOIN "Company" c ON c.id = e."companyId"
          ORDER BY e."createdAt" DESC LIMIT 15''', "Employees in platform DB + company names")
q(cur, 'SELECT id, code, name FROM "Company" ORDER BY "createdAt" DESC LIMIT 15', "Companies in platform DB")
conn.close()
