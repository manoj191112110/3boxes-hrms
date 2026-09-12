#!/usr/bin/env python3
"""Verify demo user passwords by bcrypt comparison. DEMO DB ONLY."""
import psycopg2
import bcrypt

HOST = "ep-blue-fire-aqk8jxd2.c-8.us-east-1.aws.neon.tech"
USER = "neondb_owner"
PASS = "npg_pxZd8woKe4WB"
DB = "tenant_3boxes-hrms-demo"

CANDIDATE_PASSWORDS = ["MarqAI@2026", "Password@123", "Demo@2026", "Admin@123", "password123", "3boxes@2026"]

EMAILS = [
    "superadmin@3boxeshrms.com",
    "admin@3boxeshrms.com",
    "admin@marqaitechgroup.com",
    "amit.reddy@innovatech.demo",
    "bala.mukherjee@innovatech.demo",
    "meera.bansal@technova.demo",
]

conn = psycopg2.connect(host=HOST, user=USER, password=PASS, dbname=DB, sslmode="require")
cur = conn.cursor()
for email in EMAILS:
    cur.execute('SELECT email, "password" FROM "User" WHERE email = %s', (email,))
    row = cur.fetchone()
    if not row:
        print(f"{email}: NOT FOUND")
        continue
    _, pwhash = row
    matched = None
    for pwd in CANDIDATE_PASSWORDS:
        try:
            if bcrypt.checkpw(pwd.encode(), pwhash.encode()):
                matched = pwd
                break
        except Exception:
            pass
    print(f"{email}: {'MATCH -> ' + matched if matched else 'NO MATCH among candidates'}")
cur.close()
conn.close()
