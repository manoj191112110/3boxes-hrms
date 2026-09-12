#!/usr/bin/env python3
"""Inspect current demo tenant DB state: users, companies, departments, job postings, candidates."""
import psycopg2

HOST = "ep-blue-fire-aqk8jxd2.c-8.us-east-1.aws.neon.tech"
USER = "neondb_owner"
PASS = "npg_pxZd8woKe4WB"
DB = "tenant_3boxes-hrms-demo"

def q(sql, params=None):
    conn = psycopg2.connect(host=HOST, user=USER, password=PASS, dbname=DB, sslmode="require")
    cur = conn.cursor()
    cur.execute(sql, params)
    rows = cur.fetchall()
    cur.close()
    conn.close()
    return rows

print("=== TENANT ===")
for r in q('SELECT id, name, slug, status FROM "Tenant"'):
    print(" ", r)

print("\n=== COMPANIES ===")
for r in q('SELECT c.id, c.name, cg.name FROM "Company" c LEFT JOIN "CompanyGroup" cg ON cg.id = c."companyGroupId" LIMIT 10'):
    print(" ", r)

print("\n=== USERS (role/status/email) ===")
for r in q('''SELECT role, status, email, name FROM "User"
              WHERE status='active' ORDER BY role LIMIT 40'''):
    print(" ", r)

print("\n=== DEPARTMENTS ===")
for r in q('SELECT d.id, d.name, c.name FROM "Department" d JOIN "Company" c ON c.id = d."companyId" LIMIT 15'):
    print(" ", r)

print("\n=== JOB POSTINGS ===")
try:
    for r in q('SELECT id, title, position, status, vacancies, "departmentId" FROM "JobPosting" ORDER BY "postedDate" DESC LIMIT 15'):
        print(" ", r)
except Exception as e:
    print("  ERROR:", e)

print("\n=== CANDIDATES count ===")
try:
    print(" ", q('SELECT count(*) FROM "Candidate"')[0])
    for r in q('SELECT "firstName", "lastName", email, status FROM "Candidate" LIMIT 10'):
        print(" ", r)
except Exception as e:
    print("  ERROR:", e)

print("\n=== JOB APPLICATIONS count ===")
try:
    print(" ", q('SELECT count(*) FROM "JobApplication"')[0])
except Exception as e:
    print("  ERROR:", e)

print("\n=== OFFERS count ===")
try:
    print(" ", q('SELECT count(*) FROM "Offer"')[0])
except Exception as e:
    print("  ERROR:", e)
