#!/usr/bin/env python3
"""
Seed LIVE tenant (tenant_marqaitechgroup) leave MODULE CONFIGURATION:
  - LeaveType rows for each ACTIVE company (codes suffixed per company —
    LeaveType.code is globally unique in this DB)
  - LeaveBalance rows (year 2026) for every ACTIVE employee x CL/SL/EL
  - NO leave requests, NO fake transactions (GOLDEN RULE: live site only
    gets configuration required for the module to function; real requests
    come from real usage).

Idempotent: skips rows that already exist (by code / employeeId+type+year).
"""
import psycopg2

HOST = "ep-blue-fire-aqk8jxd2.c-8.us-east-1.aws.neon.tech"
USER = "neondb_owner"
PASS = "npg_pxZd8woKe4WB"
DB = "tenant_marqaitechgroup"

# (base code, name, defaultDays, isPaid, carryForward)
LEAVE_TYPES = [
    ("CL", "Casual Leave", 12, True, False),
    ("SL", "Sick Leave", 10, True, False),
    ("EL", "Earned Leave", 15, True, True),
    ("ML", "Maternity Leave", 180, True, False),
    ("PTL", "Paternity Leave", 15, True, False),
    ("LWP", "Loss of Pay", 0, False, False),
]
BALANCE_CODES = ("CL", "SL", "EL")
YEAR = 2026

conn = psycopg2.connect(host=HOST, user=USER, password=PASS, dbname=DB, sslmode="require")
cur = conn.cursor()

# 1) Companies (active only)
cur.execute('SELECT id, code, name FROM "Company" WHERE status=\'active\' ORDER BY "createdAt"')
companies = cur.fetchall()
print(f"Active companies: {[(c[1], c[2]) for c in companies]}")

# 2) Leave types
created_types = 0
type_ids = {}  # (companyCode, baseCode) -> id
for cid, ccode, cname in companies:
    suffix = ccode if len(ccode) <= 5 else ccode[:5]
    for base, name, days, paid, cf in LEAVE_TYPES:
        code = f"{base}-{suffix}"
        cur.execute('SELECT id FROM "LeaveType" WHERE code=%s', (code,))
        row = cur.fetchone()
        if row:
            type_ids[(ccode, base)] = row[0]
            continue
        cur.execute(
            '''INSERT INTO "LeaveType" (id, name, code, description, "defaultDays", "isPaid",
               "carryForward", status, "companyId", "createdAt", "updatedAt")
               VALUES (gen_random_uuid()::text, %s, %s, %s, %s, %s, %s, 'active', %s, NOW(), NOW()) RETURNING id''',
            (name, code, f"{name} ({cname})", days, paid, cf, cid),
        )
        type_ids[(ccode, base)] = cur.fetchone()[0]
        created_types += 1
print(f"LeaveTypes created: {created_types}")

# 3) Balances for active employees (CL/SL/EL)
cur.execute('''SELECT e.id, c.code FROM "Employee" e JOIN "Company" c ON c.id=e."companyId"
               WHERE e.status='active' ORDER BY e."employeeId"''')
emps = cur.fetchall()
created_bal = 0
for eid, ccode in emps:
    for base in BALANCE_CODES:
        tid = type_ids.get((ccode, base))
        if not tid:
            continue
        cur.execute(
            'SELECT id FROM "LeaveBalance" WHERE "employeeId"=%s AND "leaveTypeId"=%s AND year=%s',
            (eid, tid, YEAR),
        )
        if cur.fetchone():
            continue
        total = next(t[2] for t in LEAVE_TYPES if t[0] == base)
        cur.execute(
            '''INSERT INTO "LeaveBalance" (id, "employeeId", "leaveTypeId", year, total, used, remaining, "carryForward", "createdAt", "updatedAt")
               VALUES (gen_random_uuid()::text, %s, %s, %s, %s, 0, %s, 0, NOW(), NOW())''',
            (eid, tid, YEAR, total, total),
        )
        created_bal += 1
print(f"LeaveBalances created: {created_bal} (for {len(emps)} active employees x {len(BALANCE_CODES)} types)")

conn.commit()

# 4) Verify
cur.execute('SELECT COUNT(*) FROM "LeaveType"')
print(f"Verify: LeaveType total = {cur.fetchone()[0]}")
cur.execute('SELECT COUNT(*) FROM "LeaveBalance"')
print(f"Verify: LeaveBalance total = {cur.fetchone()[0]}")
cur.execute('SELECT COUNT(*) FROM "LeaveRequest"')
print(f"Verify: LeaveRequest total = {cur.fetchone()[0]} (must stay 0 — no dummy data on live)")
conn.close()
print("DONE")
