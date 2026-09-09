#!/usr/bin/env python3
"""
Seed remaining empty tables in both tenant databases:
JobPosting, JobApplication, Interview, Offer, OfferTemplate, Policy, Ticket, TicketCategory
"""
import psycopg2
import psycopg2.extras
import random
import time
import hashlib
from datetime import datetime, timedelta

POOLER_HOST = 'ep-blue-fire-aqk8jxd2-pooler.c-8.us-east-1.aws.neon.tech'
DB_USER = 'neondb_owner'
DB_PASSWORD = 'npg_pxZd8woKe4WB'

DEMO_DB = 'tenant_demo'
MARQAI_DB = 'tenant_marqaitechgroup'

def cuid():
    t = str(time.time()).encode()
    r = str(random.random()).encode()
    return 'cl' + hashlib.md5(t + r).hexdigest()[:22]

def now_iso():
    return datetime.now().isoformat() + 'Z'

def rand_date(start, end):
    return start + timedelta(days=random.randint(0, (end - start).days))

def quoted_cols(cols):
    return ','.join(f'"{c}"' for c in cols)

def get_conn(dbname):
    conn = psycopg2.connect(
        host=POOLER_HOST, database=dbname, user=DB_USER, password=DB_PASSWORD,
        sslmode='require', connect_timeout=15
    )
    conn.autocommit = True
    return conn


def seed_ticket_categories(cur, company_ids):
    """Seed TicketCategory."""
    categories = [
        ('IT Support', 'it', 'Technical issues and IT support requests'),
        ('HR Query', 'hr', 'HR-related questions and requests'),
        ('Payroll', 'payroll', 'Salary and payroll related issues'),
        ('Facilities', 'facilities', 'Facility and infrastructure requests'),
        ('General', 'general', 'General inquiries and requests'),
    ]
    rows = []
    for company_id in company_ids:
        for name, cat_type, desc in categories:
            rows.append((cuid(), name, cat_type, desc, company_id, now_iso(), now_iso()))

    cols = ['id', 'name', 'type', 'description', 'companyId', 'createdAt', 'updatedAt']
    psycopg2.extras.execute_values(cur, f'INSERT INTO "TicketCategory" ({quoted_cols(cols)}) VALUES %s ON CONFLICT DO NOTHING', rows)
    print(f'  ✅ TicketCategory: {len(rows)} records')
    # Return category IDs for ticket creation
    cur.execute('SELECT id FROM "TicketCategory" LIMIT 20;')
    return [r[0] for r in cur.fetchall()]


def seed_tickets(cur, employee_ids, category_ids):
    """Seed Ticket (helpdesk tickets)."""
    priorities = ['low', 'medium', 'medium', 'high', 'critical']
    statuses = ['open', 'open', 'in_progress', 'in_progress', 'resolved', 'closed']
    subjects = [
        'Cannot access VPN', 'Laptop running slow', 'Need software installation',
        'Payroll discrepancy', 'Leave balance not updated', 'Office AC not working',
        'Badge access issue', 'Email not syncing', 'Printer not working',
        'Expense reimbursement delayed', 'New hire equipment request', 'Parking pass renewal',
        'Benefits enrollment question', 'Time entry correction', 'Remote access setup',
    ]

    # Ticket uses requesterId + requesterName, not employeeId
    simple_cols = ['id', 'ticketId', 'subject', 'description', 'status', 'priority',
                   'requesterType', 'requesterId', 'requesterName', 'categoryId', 'createdAt', 'updatedAt']
    simple_rows = []
    for i, emp_id in enumerate(employee_ids[:15]):
        cat_id = random.choice(category_ids) if category_ids else None
        status = random.choice(statuses)
        simple_rows.append((
            cuid(), f'TKT-{random.randint(1000, 9999)}', subjects[i % len(subjects)],
            'Please help resolve this issue as soon as possible.',
            status, random.choice(priorities),
            'employee', emp_id, f'Employee {i+1}', cat_id,
            now_iso(), now_iso()
        ))

    psycopg2.extras.execute_values(cur, f'INSERT INTO "Ticket" ({quoted_cols(simple_cols)}) VALUES %s ON CONFLICT DO NOTHING', simple_rows)
    print(f'  ✅ Ticket: {len(simple_rows)} records')


def seed_job_postings(cur, company_ids, department_ids, designation_ids):
    """Seed JobPosting."""
    positions = [
        'Senior Software Engineer', 'Product Manager', 'Data Analyst', 'UX Designer',
        'DevOps Engineer', 'Marketing Manager', 'HR Business Partner', 'Financial Analyst',
        'QA Lead', 'Sales Executive', 'Technical Architect', 'Business Analyst',
    ]
    types = ['full-time', 'full-time', 'full-time', 'part-time', 'contract']
    experiences = ['2-4 years', '3-5 years', '5-8 years', '8-12 years', '0-2 years']
    locations = ['Hyderabad', 'Mumbai', 'Bengaluru', 'Chennai', 'Pune', 'Remote']

    rows = []
    for i, position in enumerate(positions):
        dept_id = random.choice(department_ids) if department_ids else None
        status = random.choice(['open', 'open', 'open', 'closed', 'on_hold'])
        posted = rand_date(datetime(2025, 6, 1), datetime(2026, 5, 30))
        deadline = posted + timedelta(days=random.randint(15, 60))

        rows.append((
            cuid(), position,  # title
            dept_id,  # departmentId (required)
            position,  # position
            random.choice(locations),  # location
            random.choice(types),  # type
            random.choice(experiences),  # experience
            f'{random.randint(5,25)} LPA',  # salary
            f'We are looking for an experienced {position} to join our team and contribute to our growth.',  # description
            'Required: Strong technical skills, team collaboration, problem-solving ability',  # requirements
            status, posted.isoformat(), deadline.isoformat(),
            random.randint(1, 5),  # vacancies
            now_iso(), now_iso()
        ))

    cols = ['id', 'title', 'departmentId', 'position', 'location', 'type',
            'experience', 'salary', 'description', 'requirements',
            'status', 'postedDate', 'closingDate', 'vacancies',
            'createdAt', 'updatedAt']

    psycopg2.extras.execute_values(cur, f'INSERT INTO "JobPosting" ({quoted_cols(cols)}) VALUES %s ON CONFLICT DO NOTHING', rows)
    print(f'  ✅ JobPosting: {len(rows)} records')

    cur.execute('SELECT id FROM "JobPosting" LIMIT 20;')
    return [r[0] for r in cur.fetchall()]


def seed_job_applications(cur, job_posting_ids, candidate_ids):
    """Seed JobApplication."""
    if not job_posting_ids or not candidate_ids:
        print('  ⚠️  Skipping JobApplication: no job postings or candidates')
        return

    sources = ['website', 'referral', 'linkedin', 'indeed', 'other']
    statuses = ['applied', 'screening', 'interview', 'offered', 'hired', 'rejected']
    rows = []

    for posting_id in job_posting_ids:
        num_apps = random.randint(2, 5)
        for _ in range(num_apps):
            candidate_id = random.choice(candidate_ids) if candidate_ids else None
            status = random.choice(statuses)
            applied = rand_date(datetime(2025, 7, 1), datetime(2026, 6, 30))

            rows.append((
                cuid(), posting_id, candidate_id,
                f'candidate{random.randint(1,100)}@email.com',  # candidateName (fallback)
                f'candidate{random.randint(1,100)}@email.com',  # candidateEmail
                None,  # candidatePhone
                None,  # resume
                None,  # coverLetter
                random.choice(sources),
                status,
                applied.isoformat(),
                random.randint(1, 5),  # rating
                None,  # notes
                None,  # interviewDate
                None,  # expectedSalary
                now_iso(), now_iso()
            ))

    cols = ['id', 'jobPostingId', 'candidateId',
            'candidateName', 'candidateEmail', 'candidatePhone',
            'resume', 'coverLetter', 'source', 'status',
            'appliedDate', 'rating', 'notes', 'interviewDate', 'expectedSalary',
            'createdAt', 'updatedAt']

    psycopg2.extras.execute_values(cur, f'INSERT INTO "JobApplication" ({quoted_cols(cols)}) VALUES %s ON CONFLICT DO NOTHING', rows)
    print(f'  ✅ JobApplication: {len(rows)} records')

    cur.execute('SELECT id FROM "JobApplication" LIMIT 50;')
    return [r[0] for r in cur.fetchall()]


def seed_interviews(cur, application_ids, employee_ids):
    """Seed Interview."""
    if not application_ids:
        print('  ⚠️  Skipping Interview: no applications')
        return

    types = ['phone', 'video', 'onsite', 'technical', 'behavioral', 'panel']
    statuses = ['scheduled', 'completed', 'completed', 'cancelled', 'no_show']
    rows = []

    for app_id in application_ids[:20]:
        interviewer = random.choice(employee_ids) if employee_ids else None
        interview_date = rand_date(datetime(2025, 8, 1), datetime(2026, 7, 15))
        status = random.choice(statuses)

        rows.append((
            cuid(), app_id,
            random.choice(types),  # type
            interview_date.isoformat(),  # date
            f'{random.randint(9,18):02d}:{random.choice(["00","30"])}',  # time
            random.randint(30, 90),  # duration (minutes)
            'Conference Room A' if random.random() > 0.5 else None,  # location
            f'https://meet.google.com/{random.randint(100,999)}-{random.randint(100,999)}-{random.randint(100,999)}',  # meetingUrl
            interviewer,
            status,
            'Good technical skills demonstrated',  # feedback
            random.randint(1, 10),  # score
            random.randint(50, 99),  # aiScore
            'Candidate showed strong problem-solving ability',  # aiFeedback
            now_iso(), now_iso()
        ))

    cols = ['id', 'jobApplicationId', 'type', 'date', 'time', 'duration',
            'location', 'meetingUrl', 'interviewer', 'status', 'feedback',
            'score', 'aiScore', 'aiFeedback', 'createdAt', 'updatedAt']

    psycopg2.extras.execute_values(cur, f'INSERT INTO "Interview" ({quoted_cols(cols)}) VALUES %s ON CONFLICT DO NOTHING', rows)
    print(f'  ✅ Interview: {len(rows)} records')


def seed_offer_templates(cur, company_ids, tenant_id):
    """Seed OfferTemplate."""
    templates = [
        ('Standard Offer Letter', 'Standard employment offer template for regular hires'),
        ('Senior Offer Letter', 'Enhanced offer template for senior positions with stock options'),
        ('Intern Offer Letter', 'Simplified offer template for internship positions'),
        ('Contractor Offer', 'Offer template for contract-based engagements'),
    ]
    rows = []
    for name, desc in templates:
        rows.append((
            cuid(), tenant_id, name,
            '*' if random.random() > 0.5 else 'IN',  # country
            'en',  # language
            'Dear {{candidateName}},\n\nWe are pleased to offer you the position of {{position}} with a salary of {{salary}} {{currency}}.\n\nYour joining date will be {{joiningDate}} and you will be on probation for {{probationDays}} days.\n\nPlease report to {{reportingTo}} on your first day.\n\nWe look forward to having you on our team!',  # body
            None, None,  # header, footer
            '[{"title":"Confidentiality","body":"You agree to maintain confidentiality of company information."},{"title":"Non-Compete","body":"For a period of 12 months after leaving, you will not work for a direct competitor."}]',  # clauses
            True, None,  # isActive, createdBy
            now_iso(), now_iso()
        ))

    cols = ['id', 'tenantId', 'name', 'country', 'language', 'body',
            'header', 'footer', 'clauses', 'isActive', 'createdBy',
            'createdAt', 'updatedAt']

    psycopg2.extras.execute_values(cur, f'INSERT INTO "OfferTemplate" ({quoted_cols(cols)}) VALUES %s ON CONFLICT DO NOTHING', rows)
    print(f'  ✅ OfferTemplate: {len(rows)} records')

    cur.execute('SELECT id FROM "OfferTemplate" LIMIT 10;')
    return [r[0] for r in cur.fetchall()]


def seed_offers(cur, application_ids, template_ids, employee_ids, job_posting_ids):
    """Seed Offer."""
    if not application_ids:
        print('  ⚠️  Skipping Offer: no applications')
        return

    statuses = ['draft', 'pending_approval', 'approved', 'sent', 'accepted', 'rejected']
    positions = ['Senior Software Engineer', 'Product Manager', 'Data Analyst', 'UX Designer',
                 'DevOps Engineer', 'Marketing Manager', 'HR Business Partner', 'Financial Analyst']
    rows = []

    for i, app_id in enumerate(application_ids[:8]):
        template_id = random.choice(template_ids) if template_ids else None
        job_posting_id = random.choice(job_posting_ids) if job_posting_ids else None
        status = random.choice(statuses)
        offered_date = rand_date(datetime(2026, 1, 1), datetime(2026, 7, 15))
        position = positions[i % len(positions)]

        rows.append((
            cuid(), f'candidate_{i+1}@email.com', job_posting_id,
            f'Candidate {i+1}', f'candidate_{i+1}@email.com',
            position, None,  # department
            round(random.uniform(500000, 3000000), 2),  # offeredSalary
            'INR',  # offeredCurrency
            round(random.uniform(600000, 4000000), 2),  # offeredCTC
            None,  # salaryBreakdown
            offered_date.isoformat(),  # joiningDate
            90,  # probationPeriod
            None,  # reportingTo
            status,  # status
            None, None,  # approvedBy, approvedAt
            None, None, None,  # sentAt, respondedAt, responseNotes
            template_id, None, None,  # templateId, generatedPdfUrl, generatedAt
            None, None, None, None, None,  # esignProvider, esignEnvelopeId, signedPdfUrl, signedAt, signedById
            now_iso(), now_iso()
        ))

    cols = ['id', 'candidateId', 'jobPostingId',
            'candidateName', 'candidateEmail', 'position', 'department',
            'offeredSalary', 'offeredCurrency', 'offeredCTC', 'salaryBreakdown',
            'joiningDate', 'probationPeriod', 'reportingTo',
            'status', 'approvedBy', 'approvedAt',
            'sentAt', 'respondedAt', 'responseNotes',
            'templateId', 'generatedPdfUrl', 'generatedAt',
            'esignProvider', 'esignEnvelopeId', 'signedPdfUrl', 'signedAt', 'signedById',
            'createdAt', 'updatedAt']

    psycopg2.extras.execute_values(cur, f'INSERT INTO "Offer" ({quoted_cols(cols)}) VALUES %s ON CONFLICT DO NOTHING', rows)
    print(f'  ✅ Offer: {len(rows)} records')


def seed_policies(cur, company_ids):
    """Seed Policy (generic company policies)."""
    policies = [
        ('Employee Leave Policy', 'leave', 'Comprehensive leave policy for all employees'),
        ('Code of Conduct', 'code_of_conduct', 'Expected standards of behavior and conduct'),
        ('IT Usage Policy', 'it', 'Guidelines for company IT resource usage'),
        ('Safety Policy', 'safety', 'Workplace safety guidelines and procedures'),
        ('Travel Policy', 'travel', 'Business travel and expense guidelines'),
    ]
    rows = []
    for company_id in company_ids:
        for title, category, desc in policies:
            rows.append((
                cuid(), title, category, desc,
                'Full policy content here...',  # content
                '1.0', 'active',
                datetime(2025, 1, 1).isoformat(), None,  # effectiveDate, expiryDate
                company_id, now_iso(), now_iso()
            ))

    cols = ['id', 'title', 'category', 'description', 'content',
            'version', 'status', 'effectiveDate', 'expiryDate',
            'companyId', 'createdAt', 'updatedAt']

    psycopg2.extras.execute_values(cur, f'INSERT INTO "Policy" ({quoted_cols(cols)}) VALUES %s ON CONFLICT DO NOTHING', rows)
    print(f'  ✅ Policy: {len(rows)} records')


def seed_database(dbname, label, is_indian=True):
    """Seed all empty models in a tenant database."""
    print(f'\n--- Seeding {label} DATABASE ({dbname}) ---')
    try:
        conn = get_conn(dbname)
        cur = conn.cursor()

        # Get existing IDs
        cur.execute('SELECT id FROM "Tenant" LIMIT 1;')
        tenant_row = cur.fetchone()
        tenant_id = tenant_row[0] if tenant_row else None

        cur.execute('SELECT id FROM "Company" LIMIT 10;')
        company_ids = [r[0] for r in cur.fetchall()]

        cur.execute('SELECT id FROM "Department" LIMIT 20;')
        department_ids = [r[0] for r in cur.fetchall()]

        cur.execute('SELECT id FROM "Designation" LIMIT 20;')
        designation_ids = [r[0] for r in cur.fetchall()]

        cur.execute('SELECT id FROM "Employee" LIMIT 30;')
        employee_ids = [r[0] for r in cur.fetchall()]

        cur.execute('SELECT id FROM "Candidate" LIMIT 30;')
        candidate_ids = [r[0] for r in cur.fetchall()]

        print(f'  Found: tenant={tenant_id[:20] if tenant_id else "NONE"}..., {len(company_ids)} companies, {len(department_ids)} depts, {len(employee_ids)} employees, {len(candidate_ids)} candidates')

        if not tenant_id:
            print(f'  ⚠️  No tenant found, skipping')
            return

        # Seed in dependency order
        category_ids = seed_ticket_categories(cur, company_ids)
        seed_tickets(cur, employee_ids, category_ids)

        job_posting_ids = seed_job_postings(cur, company_ids, department_ids, designation_ids)
        application_ids = seed_job_applications(cur, job_posting_ids, candidate_ids)
        seed_interviews(cur, application_ids, employee_ids)

        template_ids = seed_offer_templates(cur, company_ids, tenant_id)
        seed_offers(cur, application_ids, template_ids, employee_ids, job_posting_ids)

        seed_policies(cur, company_ids)

        conn.close()
        print(f'  ✅ {label}: All empty tables seeded')
    except Exception as e:
        print(f'  ❌ {label}: Error: {e}')


if __name__ == '__main__':
    print('=' * 60)
    print('  Seeding remaining empty tables in tenant databases')
    print('=' * 60)

    seed_database(DEMO_DB, 'DEMO', is_indian=False)
    seed_database(MARQAI_DB, 'MARQAI', is_indian=True)

    # Verify
    print(f'\n{"=" * 60}')
    print(f'  Final Verification')
    print(f'{"=" * 60}')
    for dbname, label in [(DEMO_DB, 'DEMO'), (MARQAI_DB, 'MARQAI')]:
        conn = get_conn(dbname)
        cur = conn.cursor()
        empty = []
        populated = []
        for table in ['JobPosting', 'JobApplication', 'Interview', 'Offer', 'OfferTemplate', 'Policy', 'Ticket', 'TicketCategory']:
            try:
                cur.execute(f'SELECT COUNT(*) FROM "{table}";')
                count = cur.fetchone()[0]
                if count > 0:
                    populated.append(f'{table}: {count}')
                else:
                    empty.append(table)
            except Exception as e:
                empty.append(f'{table}: ERROR')
        print(f'\n  {label}:')
        for p in populated:
            print(f'    ✅ {p}')
        for e in empty:
            print(f'    ⚠️  {e}')
        conn.close()
