#!/usr/bin/env python3
"""
READ-ONLY diagnosis: where did marqaitechgroup employees go?
- Lists DBs on the Neon endpoint
- Counts employees/companies/users in tenant_marqaitechgroup
- Reads platform DB TenantDatabase mapping (masked connection strings)
- Checks AuditLog for recent DELETE actions
- Checks latest createdAt/updatedAt to see when data last changed
NEVER writes to any database.
"""

import psycopg2

HOST = "ep-blue-fire-aqk8jxd2.c-8.us-east-1.aws.neon.tech"
USER = "neondb_owner"
PASS = "npg_pxZd8woKe4WB"
CONN_PARAMS = "?sslmode=require&connect_timeout=30"


def get_conn(dbname):
    return psycopg2.connect(f"postgresql://{USER}:{PASS}@{HOST}/{dbname}{CONN_PARAMS}")


def mask(url):
    if not url:
        return "(null)"
    if "@" in url and "://" in url:
        try:
            scheme_rest = url.split("://", 1)[1]
            creds, hostpart = scheme_rest.split("@", 1)
            pw = creds.split(":", 1)[1] if ":" in creds else "***"
            return url.split("://")[0] + "://***:" + pw[:3] + "***@" + hostpart
        except Exception:
            return "(unparseable)"
    return url[:60] + "..."


def q(cur, sql, label):
    print(f"\n--- {label} ---")
    try:
        cur.execute(sql)
        cols = [d[0] for d in cur.description] if cur.description else []
        rows = cur.fetchall()
        if cols:
            print(f"({len(rows)} rows) {cols}")
            for r in rows[:25]:
                print("  ", r)
        else:
            print(f"OK ({rows[0][0] if rows else '?'})")
        return rows
    except Exception as e:
        print(f"ERROR: {e}")
        return []


def main():
    # 1. List databases on this endpoint
    conn = get_conn("postgres")
    conn.autocommit = True
    cur = conn.cursor()
    print("=" * 70)
    print("STEP 1: DATABASES ON NEON ENDPOINT")
    print("=" * 70)
    q(cur, "SELECT datname FROM pg_database WHERE NOT datistemplate ORDER BY datname", "All databases")
    conn.close()

    # 2. tenant_marqaitechgroup content
    conn = get_conn("tenant_marqaitechgroup")
    conn.autocommit = True
    cur = conn.cursor()
    print("\n" + "=" * 70)
    print("STEP 2: tenant_marqaitechgroup CONTENTS")
    print("=" * 70)
    q(cur, 'SELECT COUNT(*) AS employees FROM "Employee"', "Employee count")
    q(cur, 'SELECT COUNT(*) FROM "Company"', "Company count")
    q(cur, 'SELECT COUNT(*) FROM "User"', "User count")
    q(cur, 'SELECT COUNT(*) FROM "Attendance"', "Attendance count")
    q(cur, 'SELECT COUNT(*) FROM "Payroll"', "Payroll count")
    q(cur, 'SELECT COUNT(*) FROM "LeaveRequest"', "LeaveRequest count")
    q(cur, 'SELECT COUNT(*) FROM "EmployeeCompanyMapping"', "EmployeeCompanyMapping count")

    q(cur, '''SELECT "employeeId", "firstName", "lastName", "email", "status", "createdAt"
              FROM "Employee" ORDER BY "createdAt" DESC LIMIT 15''',
      "Latest 15 employees (by createdAt)")

    q(cur, '''SELECT COUNT(*) FROM "Employee" WHERE "createdAt" > NOW() - INTERVAL '7 days' ''',
      "Employees created in last 7 days")

    # What deleted them? audit trail
    q(cur, '''SELECT "id", "action", "entity", "createdAt", LEFT("details"::text, 200) AS details
              FROM "AuditLog" ORDER BY "createdAt" DESC LIMIT 20''',
      "Latest 20 audit logs")
    q(cur, '''SELECT "action", "entity", COUNT(*) FROM "AuditLog"
              WHERE "createdAt" > NOW() - INTERVAL '3 days'
              GROUP BY "action", "entity" ORDER BY COUNT(*) DESC LIMIT 30''',
      "Audit actions last 3 days grouped")
    conn.close()

    # 3. Platform DB — tenant DB mapping
    conn = get_conn("neondb")
    conn.autocommit = True
    cur = conn.cursor()
    print("\n" + "=" * 70)
    print("STEP 3: PLATFORM DB — TENANT DATABASE MAPPING")
    print("=" * 70)
    q(cur, '''SELECT t.slug, t.status, td."databaseName", td."isActive", td."connectionString"
              FROM "Tenant" t LEFT JOIN "TenantDatabase" td ON td."tenantId" = t.id
              ORDER BY t.slug''',
      "Tenant → TenantDatabase mapping (masked below)")
    try:
        cur.execute('''SELECT t.slug, td."databaseName", td."isActive", td."connectionString"
                       FROM "Tenant" t LEFT JOIN "TenantDatabase" td ON td."tenantId" = t.id
                       ORDER BY t.slug''')
        for slug, dbname, active, cs in cur.fetchall():
            print(f"  {slug:24s} db={dbname!s:30s} active={active} url={mask(cs)}")
    except Exception as e:
        print(f"mask print error: {e}")

    # Platform-level users of the marqaitechgroup tenant
    q(cur, '''SELECT id, slug, name, status FROM "Tenant" ORDER BY slug''', "All tenants")
    conn.close()

    # 4. Demo tenant DB contents (if exists)
    conn = get_conn("postgres")
    cur = conn.cursor()
    cur.execute("SELECT datname FROM pg_database WHERE datname LIKE 'tenant%' ORDER BY datname")
    dbs = [r[0] for r in cur.fetchall()]
    conn.close()

    print("\n" + "=" * 70)
    print("STEP 4: ALL TENANT DB CONTENTS SUMMARY")
    print("=" * 70)
    for dbname in dbs:
        try:
            c = get_conn(dbname)
            c.autocommit = True
            cc = c.cursor()
            cc.execute('SELECT COUNT(*) FROM "Employee"')
            emp = cc.fetchone()[0]
            cc.execute('SELECT COUNT(*) FROM "Company"')
            comp = cc.fetchone()[0]
            cc.execute("SELECT COUNT(*) FROM \"Employee\" WHERE email LIKE '%@%.demo'")
            demo_emails = cc.fetchone()[0]
            print(f"  {dbname:34s} employees={emp:5d} companies={comp:3d} demo-email-employees={demo_emails}")
            c.close()
        except Exception as e:
            print(f"  {dbname:34s} ERROR: {str(e)[:80]}")


if __name__ == "__main__":
    main()
