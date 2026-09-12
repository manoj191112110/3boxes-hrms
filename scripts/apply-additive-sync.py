#!/usr/bin/env python3
"""
Apply an ADDITIVE-ONLY sync SQL file to a database, statement by statement,
with per-statement error tolerance ("already exists" is fine — idempotent).
Then verify the critical Employee.credentialsStatus column exists.

Usage: python3 scripts/apply-additive-sync.py <db_name> <sql_file>
"""
import sys
import psycopg2

HOST = "ep-blue-fire-aqk8jxd2.c-8.us-east-1.aws.neon.tech"
USER = "neondb_owner"
PASS = "npg_pxZd8woKe4WB"

BENIGN_ERRORS = ("already exists", "duplicate object", "multiple primary keys")


def main(dbname, sqlfile):
    sql = open(sqlfile).read()
    # Split on ';' at line ends — every statement in our generated file ends with ';'
    stmts = []
    buf = []
    for line in sql.splitlines():
        if line.strip().startswith("--") and not buf:
            continue
        buf.append(line)
        if line.rstrip().endswith(";"):
            stmt = "\n".join(buf).strip()
            if stmt:
                stmts.append(stmt)
            buf = []
    tail = "\n".join(buf).strip()
    if tail:
        stmts.append(tail)

    print(f"[apply] {len(stmts)} statements -> {dbname}")

    conn = psycopg2.connect(
        f"postgresql://{USER}:{PASS}@{HOST}/{dbname}?sslmode=require&connect_timeout=30"
    )
    conn.autocommit = True
    cur = conn.cursor()

    ok = fail = benign = 0
    for i, stmt in enumerate(stmts, 1):
        one_line = " ".join(stmt.split())[:100]
        try:
            cur.execute(stmt)
            ok += 1
            if i <= 5 or "Employee" in stmt[:40]:
                print(f"  ok  #{i}: {one_line}")
        except Exception as e:
            msg = str(e).lower()
            if any(b in msg for b in BENIGN_ERRORS):
                benign += 1
                print(f"  skip #{i} (exists): {one_line}")
            else:
                fail += 1
                print(f"  FAIL #{i}: {one_line}\n        -> {str(e)[:200]}")

    print(f"\n[apply] done: ok={ok} benign-skip={benign} FAILED={fail}")

    # Verify the columns that caused the outage
    for col in ("credentialsStatus", "credentialsInvitedAt", "credentialsInvitedBy"):
        cur.execute(
            """SELECT COUNT(*) FROM information_schema.columns
               WHERE table_name = 'Employee' AND column_name = %s""",
            (col,),
        )
        exists = cur.fetchone()[0]
        print(f"[verify] Employee.{col} exists: {bool(exists)}")

    cur.execute('SELECT COUNT(*) FROM "Employee"')
    print(f"[verify] Employee row count (unchanged): {cur.fetchone()[0]}")
    conn.close()
    return fail == 0


if __name__ == "__main__":
    success = main(sys.argv[1], sys.argv[2])
    sys.exit(0 if success else 1)
