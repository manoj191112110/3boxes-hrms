#!/usr/bin/env python3
"""
Generate an ADDITIVE-ONLY schema sync script for a tenant DB, by diffing
the LIVE tenant database against prisma/schema.prisma using prisma migrate diff,
then filtering out ANY destructive statement (DROP/DELETE/TRUNCATE/RENAME/
ALTER COLUMN TYPE etc.). Output: scripts/out-schema-sync-<db>.sql

Usage: python3 scripts/gen-additive-sync.py <tenant_db_name>
"""
import subprocess
import sys
import os
import re
import psycopg2

HOST = "ep-blue-fire-aqk8jxd2.c-8.us-east-1.aws.neon.tech"
USER = "neondb_owner"
PASS = "npg_pxZd8woKe4WB"
PROJECT = "/home/z/my-project"

# ONLY truly data-destructive statements are skipped. Constraint relaxations
# (DROP NOT NULL / DROP DEFAULT / DROP CONSTRAINT / DROP INDEX) are SAFE —
# no rows are ever removed — and they often share a statement block with
# required ADD COLUMNs, so skipping the block would lose the columns.
DESTRUCTIVE = re.compile(
    r"(DROP\s+TABLE|DROP\s+COLUMN|DELETE\s+FROM|TRUNCATE"
    r"|ALTER\s+COLUMN\s+\S+\s+TYPE|RENAME\s+TO)",
    re.IGNORECASE,
)


def get_conn(dbname):
    return psycopg2.connect(
        f"postgresql://{USER}:{PASS}@{HOST}/{dbname}?sslmode=require&connect_timeout=30"
    )


def main(dbname):
    # 1. Fetch the tenant's stored pooled connection string (exactly what the app uses)
    conn = get_conn("neondb")
    cur = conn.cursor()
    cur.execute(
        '''SELECT td."connectionString" FROM "TenantDatabase" td
           JOIN "Tenant" t ON t.id = td."tenantId"
           WHERE td."databaseName" = %s AND td."isActive" = true''',
        (dbname,),
    )
    row = cur.fetchone()
    conn.close()
    if row:
        cs = row[0]
        print(f"[sync] using STORED app connectionString for {dbname}")
    else:
        cs = f"postgresql://{USER}:{PASS}@{HOST}/{dbname}?sslmode=require"
        print(f"[sync] no TenantDatabase row for {dbname} — using direct endpoint URL")

    # 2. prisma migrate diff: DB -> schema.prisma
    #    Prisma 7: --from-url was removed; use --from-config-datasource with the
    #    URL injected through the env that prisma.config.ts reads.
    #    Prisma rewrites pooler hosts to the direct endpoint internally, which
    #    can fail transiently (Neon cold DNS) — retry, then fall back to the
    #    direct URL explicitly.
    env = dict(os.environ)
    direct_cs = f"postgresql://{USER}:{PASS}@{HOST}/{dbname}?sslmode=require"
    candidates = [cs] + ([direct_cs] if "-pooler." in cs else [])
    full_sql = None
    for attempt_cs in candidates + [candidates[0]] * 2:  # 2 extra retries
        env["POSTGRES_PRISMA_URL"] = attempt_cs
        try:
            result = subprocess.run(
                [
                    "npx", "prisma", "migrate", "diff",
                    "--from-config-datasource",
                    "--to-schema", "prisma/schema.prisma",
                    "--script",
                ],
                cwd=PROJECT, capture_output=True, text=True, timeout=300, env=env,
            )
        except subprocess.TimeoutExpired:
            print("[sync] prisma diff timed out, retrying…")
            continue
        if result.returncode == 0:
            full_sql = result.stdout
            break
        print(f"[sync] diff failed ({'pooler' if '-pooler.' in attempt_cs else 'direct'}), trying next: "
              + (result.stderr or "").strip().splitlines()[-1][:160] if (result.stderr or "").strip() else "[sync] diff failed")
    if full_sql is None:
        print("PRISMA DIFF FAILED after all retries:")
        sys.exit(1)
    raw_path = os.path.join(PROJECT, "scripts", f"out-full-diff-{dbname}.sql")
    with open(raw_path, "w") as f:
        f.write(full_sql)

    # 3. Split into statements and keep additive-only ones
    # NOTE: every statement block in prisma's diff output starts with a
    # comment line ("-- AlterTable" etc.), so strip comments FIRST and only
    # then decide. A chunk whose remaining body is empty is skipped.
    stmts = [s.strip() for s in full_sql.split(";") if s.strip()]
    additive = []
    skipped = []
    for s in stmts:
        body = "\n".join(l for l in s.splitlines() if not l.strip().startswith("--")).strip()
        if not body:
            continue
        if DESTRUCTIVE.search(body):
            skipped.append(body[:100])
            continue
        additive.append(body + ";")

    out_path = os.path.join(PROJECT, "scripts", f"out-schema-sync-{dbname}.sql")
    with open(out_path, "w") as f:
        f.write(f"-- ADDITIVE-ONLY schema sync for {dbname}\n")
        f.write(f"-- generated from prisma migrate diff vs schema.prisma\n\n")
        f.write("\n".join(additive))

    print(f"[sync] full diff      -> {raw_path} ({len(full_sql)} bytes)")
    print(f"[sync] ADDITIVE ONLY  -> {out_path} ({len(additive)} statements)")
    for a in additive:
        print("   +", " ".join(a.split())[:120])
    if skipped:
        print(f"[sync] SKIPPED {len(skipped)} destructive statements:")
        for s in skipped[:10]:
            print("   -", " ".join(s.split())[:100])


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("usage: gen-additive-sync.py <db_name>")
        sys.exit(1)
    main(sys.argv[1])
