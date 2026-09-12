#!/usr/bin/env python3
"""
Check the neondb platform database for any remaining MarqAI employees.
"""

import psycopg2

HOST = "ep-blue-fire-aqk8jxd2.c-8.us-east-1.aws.neon.tech"
USER = "neondb_owner"
PASS = "npg_pxZd8woKe4WB"
CONN_PARAMS = "?sslmode=require&connect_timeout=30"

def get_conn(dbname):
    return psycopg2.connect(f"postgresql://{USER}:{PASS}@{HOST}/{dbname}{CONN_PARAMS}")

MARQAI_TENANT_ID = "cmrmr3ntfe522ce1f3f1e37c6e7"

# Check neondb
print("=" * 60)
print("CHECKING neondb FOR MarqAI TENANT DATA")
print("=" * 60)

conn = get_conn("neondb")
conn.autocommit = True
cur = conn.cursor()

# Get MarqAI companies in neondb
sql = f'SELECT c.id, c.name FROM "Company" c JOIN "CompanyGroup" cg ON c."companyGroupId" = cg.id WHERE cg."tenantId" = \'{MARQAI_TENANT_ID}\''
cur.execute(sql)
companies = cur.fetchall()
print(f"MarqAI companies in neondb: {len(companies)}")
for c in companies:
    print(f"  ID: {c[0]}, Name: {c[1]}")

# Get MarqAI employees in neondb
if companies:
    company_ids = [c[0] for c in companies]
    placeholders = ','.join([f"'{cid}'" for cid in company_ids])
    sql = f'SELECT id, "firstName", "lastName", email, "employeeId", "companyId", status FROM "Employee" WHERE "companyId" IN ({placeholders})'
    cur.execute(sql)
    employees = cur.fetchall()
    print(f"\nMarqAI employees in neondb: {len(employees)}")
    for e in employees:
        print(f"  ID: {e[0]}, Name: {e[1]} {e[2]}, Email: {e[3]}, EmployeeId: {e[4]}, Company: {e[5]}, Status: {e[6]}")

    # Get MarqAI users in neondb
    sql = f'SELECT id, name, email, role FROM "User" WHERE "tenantId" = \'{MARQAI_TENANT_ID}\''
    cur.execute(sql)
    users = cur.fetchall()
    print(f"\nMarqAI users in neondb: {len(users)}")
    for u in users:
        print(f"  ID: {u[0]}, Name: {u[1]}, Email: {u[2]}, Role: {u[3]}")

conn.close()

print("\n" + "=" * 60)
print("CHECK COMPLETE")
