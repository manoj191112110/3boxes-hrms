#!/usr/bin/env python3
"""Check demo user password hashes and verify they match expected passwords."""
import psycopg2

HOST = "ep-blue-fire-aqk8jxd2.c-8.us-east-1.aws.neon.tech"
USER = "neondb_owner"
PASS = "npg_pxZd8woKe4WB"
CONN_PARAMS = "?sslmode=require&connect_timeout=30"

# Check tenant_demo
conn = psycopg2.connect(f"postgresql://{USER}:{PASS}@{HOST}/tenant_demo{CONN_PARAMS}")
conn.autocommit = True
cur = conn.cursor()

print("=== tenant_demo - Demo user password hashes ===")
sql = "SELECT id, email, password FROM \"User\" WHERE email LIKE '%3boxeshrms.com'"
cur.execute(sql)
for row in cur.fetchall():
    pw = row[2] if row[2] else "NULL"
    print(f"  Email: {row[1]}, PW hash start: {pw[:40]}")

# Check neondb
conn2 = psycopg2.connect(f"postgresql://{USER}:{PASS}@{HOST}/neondb{CONN_PARAMS}")
conn2.autocommit = True
cur2 = conn2.cursor()

print("\n=== neondb - Platform user password hashes ===")
sql = "SELECT id, email, password FROM \"User\" WHERE email LIKE '%3boxeshrms.com' OR email = 'superadmin@3boxeshrms.com'"
cur2.execute(sql)
for row in cur2.fetchall():
    pw = row[2] if row[2] else "NULL"
    print(f"  Email: {row[1]}, PW hash start: {pw[:40]}")

conn.close()
conn2.close()
