#!/usr/bin/env python3
"""
Clean up neondb (platform DB) - remove stale MarqAI dummy users 
that were deleted from the tenant_marqaitechgroup DB.
Keep only essential users.
"""

import psycopg2

HOST = "ep-blue-fire-aqk8jxd2.c-8.us-east-1.aws.neon.tech"
USER = "neondb_owner"
PASS = "npg_pxZd8woKe4WB"
CONN_PARAMS = "?sslmode=require&connect_timeout=30"

def get_conn(dbname):
    return psycopg2.connect(f"postgresql://{USER}:{PASS}@{HOST}/{dbname}{CONN_PARAMS}")

MARQAI_TENANT_ID = "cmrmrwc00xwda0d4340861d7291"

# Clean up neondb
print("=" * 60)
print("CLEANING UP neondb (Platform DB)")
print("=" * 60)

conn = get_conn("neondb")
conn.autocommit = True
cur = conn.cursor()

# List all MarqAI users in neondb
print("\n--- Current MarqAI users in neondb ---")
cur.execute(f'SELECT id, name, email, role FROM "User" WHERE "tenantId" = \'{MARQAI_TENANT_ID}\'')
users = cur.fetchall()
print(f"Total: {len(users)}")
for u in users:
    print(f"  {u[0]}: {u[1]} ({u[2]}) - role: {u[3]}")

# Keep only essential users:
# 1. superadmin@3boxeshrms.com (super_admin) - can log in anywhere
# 2. hr@marqaitech.com (admin) - MarqAI HR Admin 
# 3. admin@marqaitechgroup.com (tenant_admin) - MarqAI tenant admin
KEEP_USER_IDS = [
    "cmrmrwc019z8c6772f879e5f31b",  # superadmin@3boxeshrms.com
    "cmrmrwc0ecq3ca9f187d28dfb0f",  # hr@marqaitech.com (HR Admin)
    "cmrmrwc01g1f729abb99bd0e990",  # admin@marqaitechgroup.com (tenant_admin)
]

# Remove stale users (Rajesh Kumar, Priya Sharma, and other MarqAI dummy users)
REMOVE_IDS = []
for u in users:
    if u[0] not in KEEP_USER_IDS:
        REMOVE_IDS.append(u[0])
        print(f"  Removing: {u[1]} ({u[2]}) - role: {u[3]}")

print(f"\nRemoving {len(REMOVE_IDS)} stale users from neondb...")
for uid in REMOVE_IDS:
    try:
        cur.execute(f'DELETE FROM "User" WHERE id = \'{uid}\'')
        print(f"  Deleted: {uid} ({cur.rowcount} row)")
    except Exception as e:
        print(f"  Error deleting {uid}: {e}")

# Verify remaining MarqAI users
print("\n--- Remaining MarqAI users in neondb ---")
cur.execute(f'SELECT id, name, email, role FROM "User" WHERE "tenantId" = \'{MARQAI_TENANT_ID}\'')
remaining = cur.fetchall()
print(f"Total: {len(remaining)}")
for u in remaining:
    print(f"  {u[0]}: {u[1]} ({u[2]}) - role: {u[3]}")

conn.close()
print("\n" + "=" * 60)
print("CLEANUP COMPLETE")
