#!/usr/bin/env python3
"""
Seed new models (BankAccount, GratuityLedger, Setting, Candidate, CompanyPolicy)
in both tenant databases. Uses psycopg2 batch inserts for speed.
"""
import psycopg2
import psycopg2.extras
import random
import time
from datetime import datetime, timedelta

POOLER_HOST = 'ep-blue-fire-aqk8jxd2-pooler.c-8.us-east-1.aws.neon.tech'
DB_USER = 'neondb_owner'
DB_PASSWORD = 'npg_pxZd8woKe4WB'

DEMO_DB = 'tenant_demo'
MARQAI_DB = 'tenant_marqaitechgroup'

def get_conn(dbname):
    conn = psycopg2.connect(
        host=POOLER_HOST, database=dbname, user=DB_USER, password=DB_PASSWORD,
        sslmode='require', connect_timeout=15
    )
    conn.autocommit = True
    return conn

def cuid():
    """Generate a CUID-like ID."""
    import hashlib
    t = str(time.time()).encode()
    r = str(random.random()).encode()
    return 'cl' + hashlib.md5(t + r).hexdigest()[:22]

def quoted_cols(cols):
    """Generate quoted column list for SQL: "col1","col2",..."""
    return ','.join(f'"{c}"' for c in cols)

def now_iso():
    return datetime.utcnow().isoformat() + 'Z'

def rand_date(start, end):
    return start + timedelta(days=random.randint(0, (end - start).days))

# ──────────────────────────────────────────────────────────
# Indian data for MarqAI DB
# ──────────────────────────────────────────────────────────
INDIAN_BANKS = [
    'State Bank of India', 'HDFC Bank', 'ICICI Bank', 'Axis Bank',
    'Kotak Mahindra Bank', 'Punjab National Bank', 'Bank of Baroda',
    'Canara Bank', 'Union Bank of India', 'IndusInd Bank'
]
INDIAN_IFSC_PREFIXES = ['SBIN', 'HDFC', 'ICIC', 'UTIB', 'KKBK', 'PUNB', 'BARB', 'CNRB', 'UBIN', 'INDB']
INDIAN_CITIES = ['Mumbai', 'Hyderabad', 'Bengaluru', 'Chennai', 'Pune', 'Delhi', 'Kolkata', 'Ahmedabad']
IFSC_FORMAT = '{prefix}0{branch:04d}'

# ──────────────────────────────────────────────────────────
# American data for Demo DB
# ──────────────────────────────────────────────────────────
US_BANKS = [
    'Chase Bank', 'Bank of America', 'Wells Fargo', 'Citibank',
    'US Bank', 'PNC Bank', 'Capital One', 'TD Bank',
    'Goldman Sachs', 'Ally Bank'
]
US_CITIES = ['New York', 'San Francisco', 'Chicago', 'Austin', 'Seattle', 'Boston', 'Denver', 'Miami']

# ──────────────────────────────────────────────────────────
# Candidate data
# ──────────────────────────────────────────────────────────
CANDIDATE_FIRST_NAMES = ['Amit', 'Priya', 'Rahul', 'Ananya', 'Vikram', 'Deepa', 'Suresh', 'Kavitha',
                          'James', 'Sarah', 'Michael', 'Emily', 'David', 'Jessica', 'Robert', 'Jennifer']
CANDIDATE_LAST_NAMES = ['Sharma', 'Reddy', 'Patel', 'Iyer', 'Kumar', 'Nair', 'Menon', 'Joshi',
                         'Johnson', 'Williams', 'Smith', 'Brown', 'Davis', 'Wilson', 'Taylor', 'Anderson']
CANDIDATE_SKILLS = {
    'engineering': ['JavaScript', 'Python', 'Java', 'React', 'Node.js', 'AWS', 'Docker', 'Kubernetes', 'TypeScript', 'Go'],
    'sales': ['Business Development', 'Account Management', 'CRM', 'Negotiation', 'Pipeline Management'],
    'leadership': ['Team Management', 'Strategy', 'Operations', 'Budgeting', 'Stakeholder Management'],
    'design': ['Figma', 'Sketch', 'Adobe XD', 'UI/UX Design', 'Prototyping', 'User Research'],
    'data': ['SQL', 'Python', 'Machine Learning', 'Data Visualization', 'ETL', 'Spark', 'Tableau'],
}
CANDIDATE_SOURCES = ['direct', 'referral', 'job_board', 'linkedin', 'naukri', 'indeed', 'internal', 'campus', 'agency']
CANDIDATE_STATUSES = ['new', 'screening', 'shortlisted', 'interviewing', 'offered', 'hired', 'rejected', 'on_hold', 'warm_pool', 'talent_pool']

# ──────────────────────────────────────────────────────────
# Company Policy data
# ──────────────────────────────────────────────────────────
POLICY_TEMPLATES = [
    {'title': 'Leave Policy', 'code': 'HR-LEAVE-001', 'category': 'leave', 'content': 'This policy outlines the leave entitlements and procedures for all employees.'},
    {'title': 'Code of Conduct', 'code': 'HR-COC-001', 'category': 'code_of_conduct', 'content': 'All employees are expected to maintain the highest standards of professional conduct.'},
    {'title': 'Anti-Harassment Policy', 'code': 'HR-POSH-001', 'category': 'anti_harassment', 'content': 'This policy is in compliance with the POSH Act 2013 and provides a framework for addressing workplace harassment.'},
    {'title': 'Remote Work Policy', 'code': 'HR-REMOTE-001', 'category': 'remote_work', 'content': 'This policy governs remote work arrangements and expectations for employees working from home or other locations.'},
    {'title': 'Travel & Expense Policy', 'code': 'HR-TRAVEL-001', 'category': 'travel', 'content': 'This policy defines the guidelines for business travel, expense reimbursement, and booking procedures.'},
    {'title': 'Data Security Policy', 'code': 'IT-SEC-001', 'category': 'data_security', 'content': 'All employees must comply with data security protocols and handle sensitive information according to classification guidelines.'},
    {'title': 'IT Acceptable Use Policy', 'code': 'IT-AUP-001', 'category': 'it', 'content': 'This policy defines acceptable use of company IT resources including computers, networks, and software.'},
    {'title': 'Compensation Policy', 'code': 'HR-COMP-001', 'category': 'compensation', 'content': 'This policy outlines the compensation structure, pay bands, and annual review process.'},
    {'title': 'Disciplinary Policy', 'code': 'HR-DISC-001', 'category': 'disciplinary', 'content': 'This policy defines the disciplinary procedures and consequences for policy violations.'},
    {'title': 'Dress Code Policy', 'code': 'HR-DRESS-001', 'category': 'dress_code', 'content': 'This policy outlines the dress code expectations for different work environments and occasions.'},
]

# ──────────────────────────────────────────────────────────
# Settings data
# ──────────────────────────────────────────────────────────
SETTINGS_DATA = [
    {'category': 'general', 'key': 'company_name', 'value': '3 Boxes HRMS', 'dataType': 'string', 'description': 'Organization display name'},
    {'category': 'general', 'key': 'fiscal_year_start', 'value': '"April"', 'dataType': 'string', 'description': 'Fiscal year start month'},
    {'category': 'general', 'key': 'date_format', 'value': '"DD/MM/YYYY"', 'dataType': 'string', 'description': 'Default date display format'},
    {'category': 'general', 'key': 'timezone', 'value': '"Asia/Kolkata"', 'dataType': 'string', 'description': 'Default timezone for the organization'},
    {'category': 'leave', 'key': 'default_leave_carry_forward', 'value': 'true', 'dataType': 'boolean', 'description': 'Allow carry forward of unused leave'},
    {'category': 'leave', 'key': 'max_carry_forward_days', 'value': '5', 'dataType': 'number', 'description': 'Maximum days that can be carried forward'},
    {'category': 'leave', 'key': 'leave_encashment_enabled', 'value': 'true', 'dataType': 'boolean', 'description': 'Enable leave encashment on exit'},
    {'category': 'attendance', 'key': 'tracking_method', 'value': '"biometric"', 'dataType': 'string', 'description': 'Attendance tracking method'},
    {'category': 'attendance', 'key': 'grace_minutes', 'value': '15', 'dataType': 'number', 'description': 'Late arrival grace period in minutes'},
    {'category': 'attendance', 'key': 'half_day_threshold_hours', 'value': '4', 'dataType': 'number', 'description': 'Minimum hours for half-day attendance'},
    {'category': 'payroll', 'key': 'payroll_frequency', 'value': '"monthly"', 'dataType': 'string', 'description': 'Payroll processing frequency'},
    {'category': 'payroll', 'key': 'payroll_processing_day', 'value': '25', 'dataType': 'number', 'description': 'Day of month for payroll processing'},
    {'category': 'payroll', 'key': 'payday', 'value': '1', 'dataType': 'number', 'description': 'Day of month for salary credit'},
    {'category': 'payroll', 'key': 'overtime_multiplier', 'value': '1.5', 'dataType': 'number', 'description': 'Overtime pay multiplier'},
    {'category': 'payroll', 'key': 'gratuity_enabled', 'value': 'true', 'dataType': 'boolean', 'description': 'Enable gratuity provisions'},
    {'category': 'recruitment', 'key': 'auto_screening_enabled', 'value': 'true', 'dataType': 'boolean', 'description': 'Enable AI-powered resume screening'},
    {'category': 'recruitment', 'key': 'resume_score_threshold', 'value': '60', 'dataType': 'number', 'description': 'Minimum AI score to shortlist candidate'},
    {'category': 'notification', 'key': 'email_notifications', 'value': 'true', 'dataType': 'boolean', 'description': 'Send email notifications'},
    {'category': 'notification', 'key': 'leave_request_notify_manager', 'value': 'true', 'dataType': 'boolean', 'description': 'Notify manager on leave request'},
    {'category': 'approval', 'key': 'expense_approval_required', 'value': 'true', 'dataType': 'boolean', 'description': 'Require approval for expense claims'},
    {'category': 'approval', 'key': 'expense_auto_approve_limit', 'value': '5000', 'dataType': 'number', 'description': 'Auto-approve expenses below this amount'},
    {'category': 'security', 'key': 'password_min_length', 'value': '8', 'dataType': 'number', 'description': 'Minimum password length'},
    {'category': 'security', 'key': 'session_timeout_minutes', 'value': '30', 'dataType': 'number', 'description': 'Session timeout in minutes'},
    {'category': 'security', 'key': 'two_factor_enabled', 'value': 'false', 'dataType': 'boolean', 'description': 'Enable two-factor authentication'},
    {'category': 'ui', 'key': 'primary_color', 'value': '"#3B82F6"', 'dataType': 'string', 'description': 'Primary UI color'},
    {'category': 'ui', 'key': 'sidebar_collapsed', 'value': 'false', 'dataType': 'boolean', 'description': 'Sidebar default state'},
]


def seed_bank_accounts(cur, employee_ids, is_indian=True):
    """Seed BankAccount for each employee."""
    banks = INDIAN_BANKS if is_indian else US_BANKS
    ifsc_prefixes = INDIAN_IFSC_PREFIXES if is_indian else None

    rows = []
    for i, emp_id in enumerate(employee_ids):
        bank = random.choice(banks)
        if is_indian:
            prefix = random.choice(INDIAN_IFSC_PREFIXES)
            ifsc = prefix + '0' + str(random.randint(100, 9999)).zfill(4)
            account_number = str(random.randint(1000000000, 9999999999))
            account_type = random.choice(['savings', 'salary', 'current'])
            branch = random.choice(INDIAN_CITIES) + ' Branch'
        else:
            ifsc = None
            account_number = str(random.randint(1000000000, 9999999999))
            account_type = random.choice(['savings', 'checking'])
            branch = random.choice(US_CITIES) + ' Branch'

        is_primary = (i == 0) or random.random() < 0.8
        rows.append((
            cuid(), emp_id, f'Employee {i+1}', bank, account_number, None,
            ifsc, None, branch, None, account_type,
            'INR' if is_indian else 'USD',
            random.random() < 0.8, None, None, None,
            'active', is_primary, now_iso(), None,
            now_iso(), now_iso()
        ))

    cols = ['id', 'employeeId', 'accountHolderName', 'bankName', 'accountNumber', 'confirmAccountNumber',
            'ifscCode', 'micrCode', 'branchName', 'branchAddress', 'accountType',
            'currency', 'isVerified', 'verifiedBy', 'verifiedAt', 'verificationDoc',
            'status', 'isPrimary', 'effectiveFrom', 'effectiveTo',
            'createdAt', 'updatedAt']

    psycopg2.extras.execute_values(cur, f'INSERT INTO "BankAccount" ({quoted_cols(cols)}) VALUES %s ON CONFLICT DO NOTHING', rows)
    print(f'  ✅ BankAccount: {len(rows)} records')


def seed_gratuity_ledger(cur, employee_ids, company_ids, is_indian=True):
    """Seed GratuityLedger for eligible employees (simulated 5+ years)."""
    rows = []
    financial_years = ['2024-25', '2025-26', '2026-27']

    for emp_id in employee_ids:
        # Simulate: 40% of employees have 5+ years (eligible for gratuity)
        years_of_service = random.uniform(0.5, 15)
        is_eligible = years_of_service >= 5
        basic_salary = random.uniform(20000, 150000) if is_indian else random.uniform(2000, 12000)
        da = basic_salary * random.uniform(0.05, 0.4) if is_indian else 0

        for fy in financial_years:
            for month in range(1, 13, 3):  # Every 3rd month to keep it manageable
                monthly_provision = round((basic_salary + da) * 15 / 26 / 12, 2)
                accumulated = monthly_provision * month
                gratuity_earned = round((basic_salary + da) * 15 / 26 * years_of_service, 2)

                company_id = random.choice(company_ids)
                rows.append((
                    cuid(), emp_id, company_id, fy, month,
                    round(basic_salary, 2), round(da, 2),
                    round(years_of_service, 2), int(years_of_service),
                    monthly_provision, round(accumulated, 2),
                    gratuity_earned, round(monthly_provision * 0.95, 2),
                    0, 0, 0,
                    is_eligible,
                    None, None,
                    'provisioned', None, None,
                    'INR' if is_indian else 'USD',
                    now_iso(), now_iso()
                ))

    cols = ['id', 'employeeId', 'companyId', 'financialYear', 'month',
            'lastDrawnBasicSalary', 'lastDrawnDA',
            'yearsOfService', 'completedYears',
            'monthlyProvision', 'accumulatedProvision',
            'gratuityEarned', 'employerContribution',
            'adjustments', 'withdrawalAmount', 'balanceAfterWithdrawal',
            'isEligible', 'eligibilityDate', 'lastDrawnSalaryDate',
            'status', 'processedAt', 'processedBy',
            'currency', 'createdAt', 'updatedAt']

    psycopg2.extras.execute_values(cur, f'INSERT INTO "GratuityLedger" ({quoted_cols(cols)}) VALUES %s ON CONFLICT DO NOTHING', rows)
    print(f'  ✅ GratuityLedger: {len(rows)} records')


def seed_settings(cur, tenant_id, company_ids):
    """Seed Setting key-value pairs for tenant and companies."""
    rows = []
    # Tenant-wide settings
    for s in SETTINGS_DATA:
        rows.append((
            cuid(), tenant_id, None, s['category'], s['key'],
            s['value'], s['dataType'], s['description'],
            True, False, None, 1, None,
            now_iso(), now_iso()
        ))
    # Company-specific overrides (for first company only)
    if company_ids:
        for s in SETTINGS_DATA[:10]:
            rows.append((
                cuid(), tenant_id, company_ids[0], s['category'], s['key'] + '_override',
                s['value'], s['dataType'], s['description'] + ' (company override)',
                True, False, s['value'], 1, None,
                now_iso(), now_iso()
            ))

    cols = ['id', 'tenantId', 'companyId', 'category', 'key',
            'value', 'dataType', 'description',
            'isEditable', 'isSecret', 'defaultValue', 'version', 'previousValue',
            'createdAt', 'updatedAt']

    psycopg2.extras.execute_values(cur, f'INSERT INTO "Setting" ({quoted_cols(cols)}) VALUES %s ON CONFLICT DO NOTHING', rows)
    print(f'  ✅ Setting: {len(rows)} records')


def seed_candidates(cur, tenant_id, company_ids, is_indian=True):
    """Seed Candidate profiles."""
    rows = []
    first_names = CANDIDATE_FIRST_NAMES
    last_names = CANDIDATE_LAST_NAMES
    num_candidates = 30 if is_indian else 25

    for i in range(num_candidates):
        first = random.choice(first_names)
        last = random.choice(last_names)
        email = f'{first.lower()}.{last.lower()}{random.randint(1,99)}@{"gmail.com" if is_indian else "gmail.com"}'
        company_id = random.choice(company_ids) if company_ids else None

        category = random.choice(list(CANDIDATE_SKILLS.keys()))
        skills_list = random.sample(CANDIDATE_SKILLS[category], min(4, len(CANDIDATE_SKILLS[category])))
        skills_str = '["' + '", "'.join(skills_list) + '"]'

        status = random.choice(CANDIDATE_STATUSES)
        source = random.choice(CANDIDATE_SOURCES)

        current_ctc = random.uniform(300000, 2500000) if is_indian else random.uniform(40000, 200000)
        expected_ctc = current_ctc * random.uniform(1.1, 1.5)

        tags_list = random.sample(['urgent', 'top-talent', 'referral-gold', 'campus-hire', 'leadership-pipeline', 'diversity'], min(2, 3))

        applied_at = rand_date(datetime(2025, 1, 1), datetime(2026, 6, 30))
        last_contacted = applied_at + timedelta(days=random.randint(1, 30))

        rows.append((
            cuid(), tenant_id, company_id, first, last, email,
            f'+{"91" if is_indian else "1"}{random.randint(1000000000, 9999999999)}',
            None,  # avatar
            random.choice(['Software Engineer', 'Senior Developer', 'Product Manager', 'Data Analyst',
                          'Sales Executive', 'HR Manager', 'DevOps Engineer', 'QA Lead',
                          'Business Analyst', 'Technical Architect']),
            random.choice(['TCS', 'Infosys', 'Wipro', 'Google', 'Microsoft', 'Amazon', 'Meta'] if not is_indian
                         else ['TCS', 'Infosys', 'Wipro', 'HCL Tech', 'Tech Mahindra', 'Flipkart', 'Swiggy']),
            random.choice(INDIAN_CITIES if is_indian else US_CITIES),
            random.uniform(1, 15),  # totalExperience
            random.randint(15, 90),  # noticePeriod
            round(current_ctc, 2), round(expected_ctc, 2),
            'INR' if is_indian else 'USD',
            skills_str,
            random.choice(['B.Tech', 'M.Tech', 'MBA', 'B.Sc', 'MCA', 'PhD']),
            random.choice(['IIT Delhi', 'IIM Bangalore', 'NIT Trichy', 'BITS Pilani',
                          'MIT', 'Stanford', 'Harvard', 'Georgia Tech'] if not is_indian
                         else ['IIT Delhi', 'IIM Bangalore', 'NIT Trichy', 'BITS Pilani', 'JNTU', 'Anna University']),
            random.randint(2015, 2024),
            source, None, None,  # sourceDetails, recruiterId
            None, None, None, None,  # resumeUrl, coverLetterUrl, linkedinUrl, portfolioUrl
            status, None,  # subStatus
            round(random.uniform(40, 95), 1),  # aiMatchScore
            round(random.uniform(-1, 1), 2),  # aiSentimentScore
            None,  # aiRecommendedRole
            last_contacted.isoformat(), None,  # lastContactedAt, nextFollowUpAt
            random.randint(0, 5),  # communicationCount
            '["' + '", "'.join(tags_list) + '"]',  # tags
            category,  # category
            random.choice(['engineering-pool', 'leadership-pool', 'general-pool', None]),  # pool
            applied_at.isoformat(),  # appliedAt
            datetime(2026, 1, 15).isoformat() if status == 'hired' else None,  # hiredAt
            datetime(2026, 3, 20).isoformat() if status == 'rejected' else None,  # rejectedAt
            True, datetime(2026, 1, 1).isoformat(), 730, False,  # consentGiven, consentDate, dataRetentionDays, anonymized
            now_iso(), now_iso()
        ))

    cols = ['id', 'tenantId', 'companyId', 'firstName', 'lastName', 'email', 'phone', 'avatar',
            'currentJobTitle', 'currentCompany', 'currentLocation',
            'totalExperience', 'noticePeriod', 'currentCTC', 'expectedCTC', 'currency',
            'skills', 'highestQualification', 'university', 'graduationYear',
            'source', 'sourceDetails', 'recruiterId',
            'resumeUrl', 'coverLetterUrl', 'linkedinUrl', 'portfolioUrl',
            'status', 'subStatus',
            'aiMatchScore', 'aiSentimentScore', 'aiRecommendedRole',
            'lastContactedAt', 'nextFollowUpAt', 'communicationCount',
            'tags', 'category', 'pool',
            'appliedAt', 'hiredAt', 'rejectedAt',
            'consentGiven', 'consentDate', 'dataRetentionDays', 'anonymized',
            'createdAt', 'updatedAt']

    psycopg2.extras.execute_values(cur, f'INSERT INTO "Candidate" ({quoted_cols(cols)}) VALUES %s ON CONFLICT DO NOTHING', rows)
    print(f'  ✅ Candidate: {len(rows)} records')


def seed_company_policies(cur, company_ids):
    """Seed CompanyPolicy for each company."""
    rows = []
    for company_id in company_ids:
        for policy in POLICY_TEMPLATES:
            status = random.choice(['active', 'active', 'active', 'draft', 'under_review'])
            effective = rand_date(datetime(2024, 1, 1), datetime(2025, 6, 1))
            review = effective + timedelta(days=365)
            rows.append((
                cuid(), company_id, policy['title'], policy['code'],
                policy['category'], policy['content'][:200], policy['content'],
                None,  # documentUrl
                '1.0', None,  # version, previousVersionId
                status, effective.isoformat(), review.isoformat(), None,  # status, effectiveDate, reviewDate, expiryDate
                None, None, None, None,  # authoredBy, ownedBy, approvedBy, approvedAt
                True, 30, 0, 0,  # requiresAcknowledgement, acknowledgementDeadlineDays, totalAcknowledged, totalPending
                'all_employees', None, None, None,  # applicableTo, departmentIds, designationIds, locationIds
                policy['category'] in ['anti_harassment', 'data_security'],  # isRegulatory
                'POSH Act 2013' if policy['category'] == 'anti_harassment' else ('GDPR Article 22' if policy['category'] == 'data_security' else None),
                None,  # penaltyForNonCompliance
                now_iso(), now_iso()
            ))

    cols = ['id', 'companyId', 'title', 'policyCode', 'category', 'description', 'content',
            'documentUrl', 'version', 'previousVersionId',
            'status', 'effectiveDate', 'reviewDate', 'expiryDate',
            'authoredBy', 'ownedBy', 'approvedBy', 'approvedAt',
            'requiresAcknowledgement', 'acknowledgementDeadlineDays', 'totalAcknowledged', 'totalPending',
            'applicableTo', 'departmentIds', 'designationIds', 'locationIds',
            'isRegulatory', 'regulationRef', 'penaltyForNonCompliance',
            'createdAt', 'updatedAt']

    psycopg2.extras.execute_values(cur, f'INSERT INTO "CompanyPolicy" ({quoted_cols(cols)}) VALUES %s ON CONFLICT DO NOTHING', rows)
    print(f'  ✅ CompanyPolicy: {len(rows)} records')


def get_ids(cur):
    """Get tenant, company, and employee IDs from the database."""
    cur.execute('SELECT id FROM "Tenant" LIMIT 1;')
    tenant = cur.fetchone()
    tenant_id = tenant[0] if tenant else None

    cur.execute('SELECT id FROM "Company" LIMIT 10;')
    company_ids = [r[0] for r in cur.fetchall()]

    cur.execute('SELECT id FROM "Employee" LIMIT 30;')
    employee_ids = [r[0] for r in cur.fetchall()]

    return tenant_id, company_ids, employee_ids


def seed_database(dbname, label, is_indian=True):
    """Seed all new models in a tenant database."""
    print(f'\n--- Seeding {label} DATABASE ({dbname}) ---')
    try:
        conn = get_conn(dbname)
        cur = conn.cursor()

        tenant_id, company_ids, employee_ids = get_ids(cur)
        print(f'  Found: tenant={tenant_id[:20]}..., {len(company_ids)} companies, {len(employee_ids)} employees')

        if not tenant_id:
            print(f'  ⚠️  No tenant found in {dbname}, skipping')
            return

        # Seed each model
        seed_bank_accounts(cur, employee_ids, is_indian)
        seed_gratuity_ledger(cur, employee_ids, company_ids, is_indian)
        seed_settings(cur, tenant_id, company_ids)
        seed_candidates(cur, tenant_id, company_ids, is_indian)
        seed_company_policies(cur, company_ids)

        conn.close()
        print(f'  ✅ {label}: All new models seeded successfully')
    except Exception as e:
        print(f'  ❌ {label}: Error: {e}')


if __name__ == '__main__':
    print('=' * 60)
    print('  Seeding new models in tenant databases')
    print('=' * 60)

    seed_database(DEMO_DB, 'DEMO', is_indian=False)
    seed_database(MARQAI_DB, 'MARQAI', is_indian=True)

    # Verify counts
    print(f'\n{"=" * 60}')
    print(f'  Verification')
    print(f'{"=" * 60}')
    for dbname, label in [(DEMO_DB, 'DEMO'), (MARQAI_DB, 'MARQAI')]:
        conn = get_conn(dbname)
        cur = conn.cursor()
        print(f'\n  {label}:')
        for table in ['BankAccount', 'GratuityLedger', 'Setting', 'Candidate', 'CompanyPolicy']:
            try:
                cur.execute(f'SELECT COUNT(*) FROM "{table}";')
                count = cur.fetchone()[0]
                print(f'    {table}: {count}')
            except Exception as e:
                print(f'    {table}: ERROR - {str(e)[:60]}')
        conn.close()
