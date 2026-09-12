#!/usr/bin/env python3
"""
READ-ONLY diagnosis round 2:
1. Test the EXACT -pooler connection strings the app uses (both tenants)
2. Check platform DB for stray employees (marqaitechgroup tenantId, @*.demo emails)
3. Check what's inside tenant_demo (legacy demo DB)
"""
import psycopg2

HOST_DIRECT = "ep-blue-fire-aqk8jxd2.c-8.us-east-1.aws.neon.tech"
HOST_POOLER = "ep-blue-fire-aqk8jxd2-pooler.c-8.us-east-1.aws.neon.tech"
USER = "neondb_owner"
PASS = "npg_pxZd8woKe4WB"
CONN_PARAMS = "?sslmode=require&connect_timeout=10"


def try_conn(label, host, dbname):
    try:
        c = psycopg2.connect(
            f"postgresql://{USER}:{PASS}@{host}/{dbname}{CONN_PARAMS}",
            connect_timeout=10,
        )
        cur = c.cursor()
        cur.execute("SELECT 1")
        c.close()
        print(f"  [OK]      {label}")
        return True
    except Exception as e:
        print(f"  [FAIL]    {label} -> {str(e)[:110]}")
        return False


def q(cur, sql, label, max_rows=20):
    print(f"\n--- {label} ---")
    try:
        cur.execute(sql)
        if cur.description:
            rows = cur.fetchall()
            cols = [d[0] for d in cur.description]
            print(f"({len(rows)} rows)")
            for r in rows[:max_rows]:
                print("  ", r)
        else:
            print("OK")
    except Exception as e:
        print(f"ERROR: {e}")


print("=" * 70)
print("STEP A: CONNECTION TESTS (exact strings the app uses)")
print("=" * 70)
try_conn("direct  tenant_marqaitechgroup", HOST_DIRECT, "tenant_marqaitechgroup")
try_conn("POOLER  tenant_marqaitechgroup", HOST_POOLER, "tenant_marqaitechgroup")
try_conn("POOLER  tenant_3boxes-hrms-demo (mapped but missing?)", HOST_POOLER, "tenant_3boxes-hrms-demo")
try_conn("POOLER  tenant_demo (legacy)", HOST_POOLER, "tenant_demo")

print("\n" + "=" * 70)
print("STEP B: PLATFORM DB (neondb) STRAY DATA CHECK")
print("=" * 70)
c = psycopg2.connect(f"postgresql://{USER}:{PASS}@{HOST_DIRECT}/neondb?sslmode=require")
c.autocommit = True
cur = c.cursor()
MQ_ID = "cmrmrwc00xwda0d4340861d7291"   # marqaitechgroup
DEMO_ID = "cmrmxegjy000604jv9ntgcshh"   # 3boxes-hrms-demo
q(cur, f'''SELECT COUNT(*) FROM "Employee" WHERE "tenantId" = '{MQ_ID}' ''', "Employees in neondb with marqaitechgroup tenantId")
q(cur, f'''SELECT "employeeId","firstName","lastName","email" FROM "Employee" WHERE "tenantId" = '{MQ_ID}' LIMIT 15''',
  "Those employees listed")
q(cur, "SELECT COUNT(*) FROM \"Employee\" WHERE email LIKE '%@%.demo'", "Employees in neondb with @*.demo emails")
q(cur, f'''SELECT COUNT(*) FROM "Company" WHERE "tenantId" = '{DEMO_ID}' OR code IN ('TNS','ISY','GDC','ASG','PHL','STE') ''',
  "Demo seed companies in neondb")
q(cur, "SELECT code, name, \"tenantId\" FROM \"Company\" ORDER BY \"createdAt\" DESC LIMIT 15", "Latest companies in neondb")
q(cur, "SELECT COUNT(*) FROM \"Employee\"", "TOTAL employees in neondb")
q(cur, f'''SELECT "firstName","lastName","email","tenantId" FROM "Employee" ORDER BY "createdAt" DESC LIMIT 20''',
  "Latest 20 employees in neondb")
c.close()

print("\n" + "=" * 70)
print("STEP C: LEGACY tenant_demo DB CONTENTS")
print("=" * 70)
c = psycopg2.connect(f"postgresql://{USER}:{PASS}@{HOST_DIRECT}/tenant_demo?sslmode=require")
c.autocommit = True
cur = c.cursor()
q(cur, '''SELECT "employeeId","firstName","lastName","email","createdAt" FROM "Employee"
          ORDER BY "createdAt" DESC LIMIT 12''', "Latest employees in tenant_demo")
q(cur, "SELECT code, name FROM \"Company\" ORDER BY \"createdAt\" DESC LIMIT 12", "Companies in tenant_demo")
q(cur, "SELECT COUNT(*) FROM \"Employee\" WHERE email LIKE '%@marqaitech%'", "marqaitech employees stuck in tenant_demo")
c.close()
