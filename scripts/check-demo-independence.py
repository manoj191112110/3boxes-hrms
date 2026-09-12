#!/usr/bin/env python3
"""
Check the neondb platform database for demo tenant users.
Login API uses getPlatformDb() which queries neondb.
"""

import psycopg2

HOST = "ep-blue-fire-aqk8jxd2.c-8.us-east-1.aws.neon.tech"
USER = "neondb_owner"
PASS = "npg_pxZd8woKe4WB"
CONN_PARAMS = "?sslmode=require&connect_timeout=30"

def get_conn(dbname):
    return psycopg2.connect(f"postgresql://{USER}:{PASS}@{HOST}/{dbname}{CONN_PARAMS}")

DEMO_TENANT_ID = "cmrmxegjy000604jv9ntgcshh"

# Check neondb for demo users
print("=" * 60)
print("CHECKING neondb PLATFORM DB FOR DEMO USERS")
print("=" * 60)

conn = get_conn("neondb")
conn.autocommit = True
cur = conn.cursor()

# Check Tenant records
print("\n--- Tenant records in neondb ---")
cur.execute('SELECT id, name, slug FROM "Tenant"')
tenants = cur.fetchall()
for t in tenants:
    print(f"  ID: {t[0]}, Name: {t[1]}, Slug: {t[2]}")

# Check User records for demo tenant
print("\n--- User records for demo tenant ---")
cur.execute(f'SELECT id, name, email, role FROM "User" WHERE "tenantId" = \'{DEMO_TENANT_ID}\'')
users = cur.fetchall()
print(f"Demo users in neondb: {len(users)}")
for u in users:
    print(f"  ID: {u[0]}, Name: {u[1]}, Email: {u[2]}, Role: {u[3]}")

# Check ALL users
print("\n--- ALL User records in neondb ---")
cur.execute('SELECT id, name, email, role, "tenantId" FROM "User"')
all_users = cur.fetchall()
print(f"Total users in neondb: {len(all_users)}")
for u in all_users:
    print(f"  ID: {u[0]}, Name: {u[1]}, Email: {u[2]}, Role: {u[3]}, Tenant: {u[4]}")

# Check TenantDatabase records
print("\n--- TenantDatabase records in neondb ---")
cur.execute('SELECT id, "tenantId", "databaseName", "connectionString", "isActive" FROM "TenantDatabase"')
td_records = cur.fetchall()
print(f"TenantDatabase records: {len(td_records)}")
for td in td_records:
    print(f"  Tenant: {td[1]}, DB: {td[2]}, Active: {td[4]}")

conn.close()

# Also check tenant_demo for its users
print("\n" + "=" * 60)
print("CHECKING tenant_demo DB FOR DEMO USERS")
print("=" * 60)

conn = get_conn("tenant_demo")
conn.autocommit = True
cur = conn.cursor()

cur.execute('SELECT id, name, email, role, "tenantId" FROM "User"')
demo_users = cur.fetchall()
print(f"Total users in tenant_demo: {len(demo_users)}")
for u in demo_users:
    print(f"  ID: {u[0]}, Name: {u[1]}, Email: {u[2]}, Role: {u[3]}, Tenant: {u[4]}")

# Check employee count
cur.execute('SELECT count(*) FROM "Employee"')
emp_count = cur.fetchone()[0]
print(f"\nEmployee count in tenant_demo: {emp_count}")

conn.close()

print("\n" + "=" * 60)
print("CHECK COMPLETE")
