#!/usr/bin/env python3
"""Insert the missing Tenant mirror row into the demo tenant DB.

The demo DB (tenant_3boxes-hrms-demo) lost its own 'Tenant' row in the
wipe. Every seeded row with tenantId FK (User, CompanyGroup, Candidate,
...) needs it. This inserts it if missing (id must match the platform
DB's Tenant.id: cmrmxegjy000604jv9ntgcshh).
"""
import psycopg2

HOST = "ep-blue-fire-aqk8jxd2.c-8.us-east-1.aws.neon.tech"
USER = "neondb_owner"
PASS = "npg_pxZd8woKe4WB"
TENANT_DB = "tenant_3boxes-hrms-demo"

TENANT_ID = "cmrmxegjy000604jv9ntgcshh"

conn = psycopg2.connect(host=HOST, user=USER, password=PASS, dbname=TENANT_DB, sslmode="require")
conn.autocommit = False
cur = conn.cursor()

# 1. Inspect required (NOT NULL, no default) columns of "Tenant"
cur.execute("""
    SELECT column_name, data_type, column_default
    FROM information_schema.columns
    WHERE table_name = 'Tenant'
    ORDER BY ordinal_position
""")
cols = cur.fetchall()
required = [c for c in cols if c[0] not in ("id",) and c[2] is None]
print("Tenant columns:", [(c[0], c[1]) for c in cols])
print("NOT NULL w/o default:", [(c[0], c[1]) for c in required])

# 2. Check if the row already exists
cur.execute('SELECT id, name, slug, status FROM "Tenant" WHERE id = %s', (TENANT_ID,))
row = cur.fetchone()
if row:
    print("Tenant mirror row already exists:", row)
else:
    # Insert with minimal required fields; NOT NULL columns without
    # defaults in this schema are only name + slug (verified above).
    insert_sql = """
        INSERT INTO "Tenant" ("id", "name", "slug", "domain", "plan", "status",
                              "country", "currency", "timezone",
                              "maxCompaniesAllowed", "createdAt", "updatedAt")
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW(), NOW())
    """
    params = (TENANT_ID, "3 Boxes HRMS Demo", "3boxes-hrms-demo",
              "nexus-hrms-mu.vercel.app", "enterprise", "active",
              "IN", "INR", "Asia/Kolkata", 10)
    try:
        cur.execute(insert_sql, params)
        conn.commit()
        print("Tenant mirror row INSERTED:", TENANT_ID)
    except Exception as e:
        conn.rollback()
        print("INSERT FAILED:", e)
        # Fallback: try bare minimum (id, name, slug) letting defaults fill rest
        try:
            cur.execute('INSERT INTO "Tenant" ("id","name","slug","createdAt","updatedAt") VALUES (%s,%s,%s,NOW(),NOW())',
                        (TENANT_ID, "3 Boxes HRMS Demo", "3boxes-hrms-demo"))
            conn.commit()
            print("Tenant mirror row INSERTED (minimal):", TENANT_ID)
        except Exception as e2:
            conn.rollback()
            print("MINIMAL INSERT ALSO FAILED:", e2)

# 3. Verify
cur.execute('SELECT id, name, slug, status, plan FROM "Tenant"')
for r in cur.fetchall():
    print("Tenant row now:", r)

cur.close()
conn.close()
