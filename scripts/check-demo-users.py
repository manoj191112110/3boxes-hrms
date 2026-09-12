#!/usr/bin/env python3
"""Diagnose why /api/public/demo-credentials returns empty arrays.

Checks User table (role/status distribution) in BOTH the platform DB (neondb)
and the demo tenant DB (tenant_3boxes-hrms-demo).
"""
import psycopg2
import json

HOST = "ep-blue-fire-aqk8jxd2.c-8.us-east-1.aws.neon.tech"
USER = "neondb_owner"
PASS = "npg_pxZd8woKe4WB"

def q(db, sql):
    conn = psycopg2.connect(host=HOST, user=USER, password=PASS, dbname=db, sslmode="require")
    cur = conn.cursor()
    cur.execute(sql)
    rows = cur.fetchall()
    cur.close()
    conn.close()
    return rows

USER_Q = """
SELECT role, status, count(*) FROM "User"
GROUP BY role, status ORDER BY role, status
"""

print("=" * 70)
print("PLATFORM DB (neondb) — User role/status distribution")
print("=" * 70)
try:
    for role, status, cnt in q("neondb", USER_Q):
        print(f"  {role:<20} {status:<12} {cnt}")
except Exception as e:
    print("  ERROR:", e)

print()
print("=" * 70)
print("DEMO TENANT DB (tenant_3boxes-hrms-demo) — User role/status distribution")
print("=" * 70)
try:
    for role, status, cnt in q("tenant_3boxes-hrms-demo", USER_Q):
        print(f"  {role:<20} {status:<12} {cnt}")
except Exception as e:
    print("  ERROR:", e)

print()
print("=" * 70)
print("DEMO TENANT DB — admins detail (email, name, role, status, tenantId)")
print("=" * 70)
try:
    rows = q("tenant_3boxes-hrms-demo", """
        SELECT email, name, role, status, "tenantId" FROM "User"
        WHERE role IN ('super_admin','tenant_admin')
        ORDER BY role, email LIMIT 30
    """)
    for r in rows:
        print(" ", r)
    if not rows:
        print("  (no admin rows at all)")
except Exception as e:
    print("  ERROR:", e)

print()
print("=" * 70)
print("DEMO TENANT DB — other table counts")
print("=" * 70)
try:
    tables = ["Company", "Employee", "Department", "CompanyGroup"]
    conn = psycopg2.connect(host=HOST, user=USER, password=PASS, dbname="tenant_3boxes-hrms-demo", sslmode="require")
    cur = conn.cursor()
    for t in tables:
        try:
            cur.execute(f'SELECT count(*) FROM "{t}"')
            print(f"  {t:<15} {cur.fetchone()[0]}")
        except Exception as te:
            conn.rollback()
            print(f"  {t:<15} ERROR {te}")
    cur.close()
    conn.close()
except Exception as e:
    print("  ERROR:", e)
