#!/usr/bin/env python3
"""Compare User IDs for the same email across platform DB and tenant DBs."""
import psycopg2

HOST = "ep-blue-fire-aqk8jxd2.c-8.us-east-1.aws.neon.tech"
USER = "neondb_owner"
PASS = "npg_pxZd8woKe4WB"

def q(db, sql, args=None):
    conn = psycopg2.connect(host=HOST, user=USER, password=PASS, dbname=db, sslmode="require")
    cur = conn.cursor()
    cur.execute(sql, args or ())
    rows = cur.fetchall()
    conn.close()
    return rows

print("=== Platform DB (neondb) users with tenantId=cmrmxegjy000604jv9ntgcshh (demo tenant) ===")
plat = q("neondb", 'SELECT id, email, role FROM "User" WHERE "tenantId"=%s ORDER BY email', ("cmrmxegjy000604jv9ntgcshh",))
for r in plat:
    print(f"  {r[0]:30} {r[1]:40} {r[2]}")

print("\n=== Demo tenant DB users ===")
demo = q("tenant_3boxes-hrms-demo", 'SELECT id, email, role FROM "User" ORDER BY email')
for r in demo:
    print(f"  {r[0]:30} {r[1]:40} {r[2]}")

demo_emails = {r[1] for r in demo}
print("\n=== MISMATCHED IDs (same email, different id between platform & demo tenant) ===")
for pid, email, role in plat:
    if email in demo_emails:
        tid = next(r[0] for r in demo if r[1] == email)
        flag = "MISMATCH" if tid != pid else "ok"
        print(f"  {email:40} platform={pid} tenant={tid} -> {flag}")

print("\n=== LIVE tenant_marqaitechgroup: employees w/ userId, and platform twins ===")
live_users = q("tenant_marqaitechgroup", 'SELECT id, email FROM "User" ORDER BY email')
plat_map = {r[1]: r[0] for r in q("neondb", 'SELECT id, email FROM "User"')}
for uid, email in live_users:
    twin = plat_map.get(email)
    flag = ""
    if twin is not None:
        flag = f"platform_twin={twin} -> {'MISMATCH' if twin != uid else 'same id'}"
    print(f"  {uid:30} {email:40} {flag}")

print("\n=== AuditLog userId FK on each DB ===")
for db in ("neondb", "tenant_3boxes-hrms-demo", "tenant_marqaitechgroup"):
    rows = q(db, """SELECT COUNT(*) FROM information_schema.table_constraints
                    WHERE constraint_name='AuditLog_userId_fkey' AND table_name='AuditLog'""")
    print(f"  {db}: AuditLog_userId_fkey exists = {rows[0][0] == 1}")
