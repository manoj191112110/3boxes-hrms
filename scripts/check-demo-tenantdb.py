#!/usr/bin/env python3
"""Check Tenant + TenantDatabase registration for the demo tenant."""
import psycopg2

HOST = "ep-blue-fire-aqk8jxd2.c-8.us-east-1.aws.neon.tech"
USER = "neondb_owner"
PASS = "npg_pxZd8woKe4WB"

conn = psycopg2.connect(host=HOST, user=USER, password=PASS, dbname="neondb", sslmode="require")
cur = conn.cursor()

print("=== Tenant rows ===")
cur.execute("""
    SELECT id, name, slug, status, "createdAt", "updatedAt"
    FROM "Tenant" ORDER BY "createdAt" DESC
""")
for r in cur.fetchall():
    print(" ", r)

print()
print("=== TenantDatabase rows (slug via Tenant join) ===")
try:
    cur.execute("""
        SELECT td.id, t.slug, td."dbName", td."connectionString", td.status,
               td."createdAt", td."updatedAt"
        FROM "TenantDatabase" td
        LEFT JOIN "Tenant" t ON t.id = td."tenantId"
        ORDER BY td."createdAt" DESC
    """)
    for r in cur.fetchall():
        slug, cs = r[1], r[3]
        cs_short = (cs[:38] + '...' + cs[-28:]) if cs else None
        print(f"  slug={slug} | dbName={r[2]} | status={r[4]}")
        print(f"    cs={cs_short}")
        print(f"    created={r[5]} updated={r[6]}")
except Exception as e:
    conn.rollback()
    print("  TenantDatabase query error:", e)

print()
print("=== Platform DB TenantUser / admin users for demo tenant ===")
cur.execute("""
    SELECT email, name, role, status, "tenantId"
    FROM "User"
    WHERE role IN ('super_admin', 'tenant_admin')
    ORDER BY role, email
""")
for r in cur.fetchall():
    print(" ", r)

cur.close()
conn.close()
