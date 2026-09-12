#!/usr/bin/env python3
"""Quick final verification of both databases"""
import psycopg2

POOLER_HOST = 'ep-blue-fire-aqk8jxd2-pooler.c-8.us-east-1.aws.neon.tech'
DB_USER = 'neondb_owner'
DB_PASSWORD = 'npg_pxZd8woKe4WB'

def get_conn(dbname):
    return psycopg2.connect(host=POOLER_HOST, database=dbname,
        user=DB_USER, password=DB_PASSWORD, sslmode='require', connect_timeout=30)

for dbname, label in [('tenant_marqaitechgroup','MarqAI'), ('tenant_demo','Demo')]:
    print(f"\n=== {label} Database ===")
    conn = get_conn(dbname)
    cur = conn.cursor()

    cur.execute('SELECT COUNT(*) FROM "Employee"')
    emp_count = cur.fetchone()[0]
    print(f"  Employees: {emp_count}")

    cur.execute('SELECT e."employeeId", e."firstName", e."lastName", u."email" FROM "Employee" e LEFT JOIN "User" u ON e."userId" = u."id" ORDER BY e."createdAt";')
    for r in cur.fetchall():
        print(f"    {r[0]}: {r[1]} {r[2]} ({r[3]})")

    cur.execute('SELECT COUNT(*) FROM "User"')
    user_count = cur.fetchone()[0]
    print(f"  Users: {user_count}")

    cur.execute('SELECT "email", "name", "role" FROM "User" ORDER BY "role";')
    for r in cur.fetchall():
        print(f"    {r[0]} ({r[1]}, {r[2]})")

    conn.close()

print("\n✅ Verification complete!")
