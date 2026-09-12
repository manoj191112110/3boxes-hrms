#!/usr/bin/env python3
"""Verify demo DB state after reseed: leave types/balances/requests,
employee companyId vs leaveType companyId alignment, reporting managers."""
import psycopg2

HOST = "ep-blue-fire-aqk8jxd2.c-8.us-east-1.aws.neon.tech"
USER = "neondb_owner"
PASS = "npg_pxZd8woKe4WB"
TENANT_DB = "tenant_3boxes-hrms-demo"

conn = psycopg2.connect(host=HOST, user=USER, password=PASS, dbname=TENANT_DB, sslmode="require")
cur = conn.cursor()

def q(sql, label):
    try:
        cur.execute(sql)
        rows = cur.fetchall()
        print(f"--- {label} ---")
        for r in rows[:12]:
            print("  ", r)
        if not rows:
            print("   (no rows)")
    except Exception as e:
        conn.rollback()
        print(f"--- {label} ERROR: {e}")

q('SELECT count(*) FROM "LeaveType"', "LeaveType count")
q('SELECT "companyId", count(*) FROM "LeaveType" GROUP BY "companyId" LIMIT 8', "LeaveType per company")
q('SELECT "companyId", count(*) FROM "Employee" GROUP BY "companyId" LIMIT 8', "Employee per company")
q("""
SELECT lt."companyId" AS lt_company, e."companyId" AS emp_company, count(*)
FROM "Employee" e JOIN "LeaveType" lt ON lt."companyId" = e."companyId"
GROUP BY 1, 2 LIMIT 8
""", "Employee↔LeaveType company join")
q('SELECT count(*) FROM "LeaveBalance"', "LeaveBalance count")
q('SELECT count(*) FROM "LeaveRequest"', "LeaveRequest count")
q('SELECT count(*) FROM "Attendance"', "Attendance count")
q('SELECT count(*) FROM "Payroll"', "Payroll count")
q('SELECT count(*) FROM "Employee" WHERE "reportingManagerId" IS NOT NULL', "Employees with reporting manager")
q("""
SELECT "leaveTypeId", count(*) FROM "LeaveBalance" GROUP BY 1 LIMIT 5
""", "LeaveBalance per type")
# Does LeaveBalance have the columns we set?
q("""
SELECT column_name, is_nullable, column_default FROM information_schema.columns
WHERE table_name='LeaveBalance' ORDER BY ordinal_position
""", "LeaveBalance columns")

cur.close()
conn.close()
