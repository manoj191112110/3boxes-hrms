#!/usr/bin/env python3
"""
Part 3: Seed Leave Types and Holidays for both tenant DBs.
Demo = US holidays, USD
MarqAI = Indian holidays, INR
"""
import psycopg2
import uuid

POOLER_HOST = 'ep-blue-fire-aqk8jxd2-pooler.c-8.us-east-1.aws.neon.tech'
DB_USER = 'neondb_owner'
DB_PASSWORD = 'npg_pxZd8woKe4WB'
DEMO_DB = 'tenant_demo'
MARQAI_DB = 'tenant_marqaitechgroup'

def uid():
    return f"seed-{uuid.uuid4().hex[:24]}"

# Demo leave types (US)
DEMO_LEAVE_TYPES = [
    ('Casual Leave', 'CL', 'Casual leave for personal matters', 12, True, True, 3, False, 'basic', 0),
    ('Sick Leave', 'SL', 'Sick leave for medical reasons', 10, True, False, 0, False, 'basic', 0),
    ('Paid Time Off', 'PTO', 'General paid time off', 15, True, True, 5, True, 'basic', 5),
    ('Maternity Leave', 'ML', 'Maternity leave for expecting mothers', 84, True, False, 0, False, 'basic', 0),
    ('Paternity Leave', 'PL', 'Paternity leave for new fathers', 10, True, False, 0, False, 'basic', 0),
    ('Bereavement Leave', 'BL', 'Leave for bereavement', 5, True, False, 0, False, 'basic', 0),
    ('Compensatory Off', 'CO', 'Compensatory off for working holidays', 1, True, False, 0, False, 'basic', 0),
    ('Unpaid Leave', 'UL', 'Unpaid leave of absence', 0, False, False, 0, False, 'basic', 0),
]

# MarqAI leave types (Indian)
MARQAI_LEAVE_TYPES = [
    ('Casual Leave', 'CL', 'Casual leave for personal matters', 12, True, True, 3, False, 'basic', 0),
    ('Sick Leave', 'SL', 'Sick leave for medical reasons', 10, True, False, 0, False, 'basic', 0),
    ('Earned Leave', 'EL', 'Earned/privileged leave', 20, True, True, 5, True, 'basic', 5),
    ('Maternity Leave', 'ML', 'Maternity leave as per Maternity Benefit Act', 182, True, False, 0, False, 'basic', 0),
    ('Paternity Leave', 'PL', 'Paternity leave for new fathers', 15, True, False, 0, False, 'basic', 0),
    ('Bereavement Leave', 'BL', 'Leave for bereavement', 5, True, False, 0, False, 'basic', 0),
    ('Compensatory Off', 'CO', 'Compensatory off for working on holidays/weekends', 1, True, False, 0, False, 'basic', 0),
    ('Loss of Pay', 'LOP', 'Leave without pay', 0, False, False, 0, False, 'basic', 0),
    ('Special Leave', 'SPL', 'Special purpose leave', 2, True, False, 0, False, 'basic', 0),
]

US_HOLIDAYS = [
    ("New Year's Day", '2025-01-01', 'US', 'Public holiday'),
    ("Martin Luther King Jr. Day", '2025-01-20', 'US', 'Federal holiday'),
    ("Presidents' Day", '2025-02-17', 'US', 'Federal holiday'),
    ("Memorial Day", '2025-05-26', 'US', 'Federal holiday'),
    ("Juneteenth", '2025-06-19', 'US', 'Federal holiday'),
    ("Independence Day", '2025-07-04', 'US', 'Federal holiday'),
    ("Labor Day", '2025-09-01', 'US', 'Federal holiday'),
    ("Columbus Day", '2025-10-13', 'US', 'Federal holiday'),
    ("Veterans Day", '2025-11-11', 'US', 'Federal holiday'),
    ("Thanksgiving Day", '2025-11-27', 'US', 'Federal holiday'),
    ("Day after Thanksgiving", '2025-11-28', 'US', 'Company holiday'),
    ("Christmas Eve", '2025-12-24', 'US', 'Company holiday'),
    ("Christmas Day", '2025-12-25', 'US', 'Federal holiday'),
    ("New Year's Eve", '2025-12-31', 'US', 'Company holiday'),
    ("New Year's Day", '2026-01-01', 'US', 'Public holiday'),
    ("Martin Luther King Jr. Day", '2026-01-19', 'US', 'Federal holiday'),
    ("Presidents' Day", '2026-02-16', 'US', 'Federal holiday'),
    ("Memorial Day", '2026-05-25', 'US', 'Federal holiday'),
    ("Independence Day", '2026-07-04', 'US', 'Federal holiday'),
    ("Labor Day", '2026-09-07', 'US', 'Federal holiday'),
    ("Thanksgiving Day", '2026-11-26', 'US', 'Federal holiday'),
    ("Christmas Day", '2026-12-25', 'US', 'Federal holiday'),
]

INDIAN_HOLIDAYS = [
    ("New Year's Day", '2025-01-01', 'IN', 'Public holiday'),
    ("Makar Sankranti", '2025-01-14', 'IN', 'Festival'),
    ("Republic Day", '2025-01-26', 'IN', 'National holiday'),
    ("Maha Shivaratri", '2025-02-26', 'IN', 'Festival'),
    ("Holi", '2025-03-14', 'IN', 'Festival of colors'),
    ("Ugadi", '2025-03-30', 'IN', 'New Year'),
    ("Eid ul-Fitr", '2025-03-31', 'IN', 'Festival'),
    ("Ambedkar Jayanti", '2025-04-14', 'IN', 'National holiday'),
    ("Good Friday", '2025-04-18', 'IN', 'Public holiday'),
    ("May Day", '2025-05-01', 'IN', 'Labour Day'),
    ("Eid ul-Adha / Bakrid", '2025-06-07', 'IN', 'Festival'),
    ("Rath Yatra", '2025-06-27', 'IN', 'Festival'),
    ("Independence Day", '2025-08-15', 'IN', 'National holiday'),
    ("Janmashtami", '2025-08-16', 'IN', 'Festival'),
    ("Ganesh Chaturthi", '2025-08-27', 'IN', 'Festival'),
    ("Milad-un-Nabi", '2025-09-05', 'IN', 'Festival'),
    ("Mahatma Gandhi Jayanti", '2025-10-02', 'IN', 'National holiday'),
    ("Dussehra", '2025-10-02', 'IN', 'Festival'),
    ("Dussehra (Additional)", '2025-10-03', 'IN', 'Company holiday'),
    ("Diwali", '2025-10-20', 'IN', 'Festival of lights'),
    ("Diwali (Additional)", '2025-10-21', 'IN', 'Company holiday'),
    ("Guru Nanak Jayanti", '2025-11-05', 'IN', 'Festival'),
    ("Christmas Day", '2025-12-25', 'IN', 'Public holiday'),
    ("Year End Holiday", '2025-12-26', 'IN', 'Company holiday'),
    ("New Year's Eve", '2025-12-31', 'IN', 'Company holiday'),
]


def seed_demo():
    print("\n=== DEMO: Leave Types + Holidays ===")
    conn = psycopg2.connect(host=POOLER_HOST, database=DEMO_DB, user=DB_USER, password=DB_PASSWORD, sslmode='require')
    conn.autocommit = True
    cur = conn.cursor()

    first_company = 'cmrmxegl5000804jvpbowg7cq'

    # Leave Types
    cur.execute('SELECT count(*) FROM "LeaveType"')
    if cur.fetchone()[0] == 0:
        for name, code, desc, days, is_paid, carry, max_carry, encash, encash_basis, max_encash in DEMO_LEAVE_TYPES:
            cur.execute(
                '''INSERT INTO "LeaveType" (id, name, code, description, "defaultDays", "isPaid", "carryForward",
                   "maxCarryForward", status, "companyId", "attachmentMandatory", "attachmentMandatoryAfterDays",
                   "collaborativeCheckEnabled", "encashmentAllowed", "encashmentBasis", "maxEncashmentDays",
                   "createdAt", "updatedAt")
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 'active', %s, false, 0, true, %s, %s, %s, NOW(), NOW())''',
                (uid(), name, code, desc, days, is_paid, carry, max_carry, first_company, encash, encash_basis, max_encash)
            )
        print("  Leave Types inserted")
    else:
        print("  Leave Types already exist, skipping")

    cur.execute('SELECT count(*) FROM "LeaveType"')
    print(f"  Leave Types: {cur.fetchone()[0]}")

    # Holidays
    cur.execute('SELECT count(*) FROM "Holiday"')
    if cur.fetchone()[0] == 0:
        for hname, hdate, hcountry, hdesc in US_HOLIDAYS:
            cur.execute(
                '''INSERT INTO "Holiday" (id, name, date, type, country, description, "isOptional", "optionalQuota",
                   "companyId", "createdAt", "updatedAt")
                   VALUES (%s, %s, %s, 'public', %s, %s, false, 0, %s, NOW(), NOW())''',
                (uid(), hname, hdate, hcountry, hdesc, first_company)
            )
        print("  Holidays inserted")
    else:
        print("  Holidays already exist, skipping")

    cur.execute('SELECT count(*) FROM "Holiday"')
    print(f"  Holidays: {cur.fetchone()[0]}")

    cur.close()
    conn.close()


def seed_marqai():
    print("\n=== MARQAI: Leave Types + Holidays ===")
    conn = psycopg2.connect(host=POOLER_HOST, database=MARQAI_DB, user=DB_USER, password=DB_PASSWORD, sslmode='require')
    conn.autocommit = True
    cur = conn.cursor()

    first_company = 'cmrmr3ntga2ecb95cccbe4a3e2d'

    # Leave Types
    cur.execute('SELECT count(*) FROM "LeaveType"')
    if cur.fetchone()[0] == 0:
        for name, code, desc, days, is_paid, carry, max_carry, encash, encash_basis, max_encash in MARQAI_LEAVE_TYPES:
            cur.execute(
                '''INSERT INTO "LeaveType" (id, name, code, description, "defaultDays", "isPaid", "carryForward",
                   "maxCarryForward", status, "companyId", "attachmentMandatory", "attachmentMandatoryAfterDays",
                   "collaborativeCheckEnabled", "encashmentAllowed", "encashmentBasis", "maxEncashmentDays",
                   "createdAt", "updatedAt")
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 'active', %s, false, 0, true, %s, %s, %s, NOW(), NOW())''',
                (uid(), name, code, desc, days, is_paid, carry, max_carry, first_company, encash, encash_basis, max_encash)
            )
        print("  Leave Types inserted")
    else:
        print("  Leave Types already exist, skipping")

    cur.execute('SELECT count(*) FROM "LeaveType"')
    print(f"  Leave Types: {cur.fetchone()[0]}")

    # Holidays
    cur.execute('SELECT count(*) FROM "Holiday"')
    if cur.fetchone()[0] == 0:
        for hname, hdate, hcountry, hdesc in INDIAN_HOLIDAYS:
            cur.execute(
                '''INSERT INTO "Holiday" (id, name, date, type, country, description, "isOptional", "optionalQuota",
                   "companyId", "createdAt", "updatedAt")
                   VALUES (%s, %s, %s, 'public', %s, %s, false, 0, %s, NOW(), NOW())''',
                (uid(), hname, hdate, hcountry, hdesc, first_company)
            )
        print("  Holidays inserted")
    else:
        print("  Holidays already exist, skipping")

    cur.execute('SELECT count(*) FROM "Holiday"')
    print(f"  Holidays: {cur.fetchone()[0]}")

    cur.close()
    conn.close()


if __name__ == '__main__':
    seed_demo()
    seed_marqai()
    print("\n✅ Part 3 done!")
