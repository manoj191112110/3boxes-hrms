#!/usr/bin/env python3
"""Check demo DB users + leave tables state (read-only)."""
import psycopg2, os

HOST = "ep-blue-fire-aqk8jxd2.c-8.us-east-1.aws.neon.tech"
USER = "neondb_owner"
PASS = "npg_pxZd8woKe4WB"

DB = os.environ.get("DB", "tenant_3boxes-hrms-demo")
conn = psycopg2.connect(host=HOST, user=USER, password=PASS, dbname=DB, sslmode="require")
cur = conn.cursor()

print(f"=== DB: {DB} ===")

# Users by role
cur.execute("""
SELECT role, COUNT(*) FROM "User" GROUP BY role ORDER BY role
""")
print("\n-- Users by role --")
for r in cur.fetchall():
    print(f"  {r[0]}: {r[1]}")

# Employee-linked users (sample)
cur.execute("""
SELECT u.email, u.role, e.id AS emp_id, e."firstName", e."lastName", e.status, c.name AS company
FROM "User" u
LEFT JOIN "Employee" e ON e."userId" = u.id
LEFT JOIN "Company" c ON c.id = e."companyId"
WHERE u.role IN ('employee','manager','hr')
ORDER BY u.email
LIMIT 12
""")
print("\n-- Employee/manager/hr users (sample) --")
for r in cur.fetchall():
    print(f"  {r[0]} | {r[1]} | emp={r[2]} | {r[3]} {r[4]} | {r[5]} | {r[6]}")

# Leave types
cur.execute('SELECT COUNT(*) FROM "LeaveType"')
print(f"\nLeaveTypes: {cur.fetchone()[0]}")
cur.execute('SELECT COUNT(*) FROM "LeaveBalance"')
print(f"LeaveBalances: {cur.fetchone()[0]}")
cur.execute('SELECT COUNT(*) FROM "LeaveRequest"')
print(f"LeaveRequests: {cur.fetchone()[0]}")

# Check LeaveRequest columns actually in DB
cur.execute("""
SELECT column_name FROM information_schema.columns
WHERE table_name='LeaveRequest' ORDER BY ordinal_position
""")
cols = [r[0] for r in cur.fetchall()]
print(f"\nLeaveRequest columns in DB: {cols}")

# LeaveWorkflowConfig rows
try:
    cur.execute('SELECT COUNT(*) FROM "LeaveWorkflowConfig"')
    print(f"LeaveWorkflowConfig rows: {cur.fetchone()[0]}")
except Exception as e:
    print(f"LeaveWorkflowConfig: ERR {e}")
try:
    cur.execute('SELECT COUNT(*) FROM "LeaveApprovalStep"')
    print(f"LeaveApprovalStep rows: {cur.fetchone()[0]}")
except Exception as e:
    print(f"LeaveApprovalStep: ERR {e}")

conn.close()
