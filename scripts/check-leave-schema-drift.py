#!/usr/bin/env python3
"""Compare demo DB 'LeaveType' (and other tables) columns vs schema.prisma."""
import psycopg2, re

HOST = "ep-blue-fire-aqk8jxd2.c-8.us-east-1.aws.neon.tech"
USER = "neondb_owner"
PASS = "npg_pxZd8woKe4WB"
TENANT_DB = "tenant_3boxes-hrms-demo"

SCHEMA = "/home/z/my-project/prisma/schema.prisma"

# 1. Parse schema.prisma for model columns
src = open(SCHEMA).read()
def model_cols(model):
    m = re.search(rf"model {model} \{{(.*?)\n\}}", src, re.S)
    cols = []
    for line in m.group(1).splitlines():
        line = line.strip()
        if not line or line.startswith("//") or line.startswith("@@"):
            continue
        parts = line.split()
        if len(parts) >= 2 and not line.startswith(("index", "unique", "map")):
            name = parts[0]
            if name not in ():
                cols.append(name)
    return cols

conn = psycopg2.connect(host=HOST, user=USER, password=PASS, dbname=TENANT_DB, sslmode="require")
cur = conn.cursor()

for model in ["LeaveType", "LeaveBalance", "LeaveRequest", "Attendance"]:
    cur.execute("""
        SELECT column_name FROM information_schema.columns
        WHERE table_name = %s ORDER BY ordinal_position
    """, (model,))
    db_cols = {r[0] for r in cur.fetchall()}
    schema_cols = set(model_cols(model))
    # schema fields that are relations (e.g. company Company?) appear as name Type? with @relation — include but mark
    missing_in_db = sorted(schema_cols - db_cols)
    extra_in_db = sorted(db_cols - schema_cols)
    print(f"=== {model} ===")
    print(f"  schema cols: {len(schema_cols)}, db cols: {len(db_cols)}")
    if missing_in_db:
        print(f"  MISSING IN DB: {missing_in_db}")
    if extra_in_db:
        print(f"  extra in DB (ignored): {extra_in_db}")
    if not missing_in_db:
        print("  OK — all schema columns present")

cur.close()
conn.close()
