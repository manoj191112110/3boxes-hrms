#!/usr/bin/env python3
"""Check conventions of existing demo candidate/application rows + candidate portal users."""
import psycopg2

HOST = "ep-blue-fire-aqk8jxd2.c-8.us-east-1.aws.neon.tech"
USER = "neondb_owner"
PASS = "npg_pxZd8woKe4WB"
DB = "tenant_3boxes-hrms-demo"

conn = psycopg2.connect(host=HOST, user=USER, password=PASS, dbname=DB, sslmode="require")
conn.autocommit = True
cur = conn.cursor()

print("=== SAMPLE CANDIDATE ROW ===")
cur.execute('''SELECT "tenantId", "companyId", skills, source, status, "aiMatchScore", tags, category,
                      "highestQualification", university, "consentGiven", currency
               FROM "Candidate" WHERE status='interviewing' LIMIT 1''')
cols = [d[0] for d in cur.description]
row = cur.fetchone()
if row:
    for c, v in zip(cols, row):
        print(f"  {c}: {v}")

print("\n=== SAMPLE JOB APPLICATION ROW ===")
cur.execute('''SELECT "jobPostingId", "candidateId", "candidateName", "candidateEmail", source, status,
                      rating, "expectedSalary", notes FROM "JobApplication" WHERE "candidateId" IS NOT NULL LIMIT 2''')
for r in cur.fetchall():
    print(" ", r)

print("\n=== CANDIDATE EMAIL INDEX MAX ===")
cur.execute('''SELECT email FROM "Candidate" ORDER BY email DESC LIMIT 3''')
for r in cur.fetchall():
    print(" ", r)

print("\n=== CANDIDATE PORTAL USERS ===")
try:
    cur.execute('SELECT email, status, "candidateId" FROM "CandidatePortalUser" LIMIT 5')
    for r in cur.fetchall():
        print(" ", r)
except Exception as e:
    print("  ERROR:", e)

print("\n=== EXISTING OFFERS (all) ===")
cur.execute('SELECT id, "candidateName", status FROM "Offer"')
print("  count:", len(cur.fetchall()))

cur.close()
conn.close()
