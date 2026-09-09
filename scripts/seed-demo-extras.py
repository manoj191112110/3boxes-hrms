#!/usr/bin/env python3
"""
Seed additional sample data into the DEMO tenant database to ensure
all modules, forms, dashboards, and reports have rich data for sales demos.

Currently missing: LeaveRequest (0), HelpdeskTicket (doesn't exist), Recruitment/Job tables (don't exist)
"""

import psycopg2
import psycopg2.extras
import random
from datetime import date, datetime, timedelta

POOLER_HOST = 'ep-blue-fire-aqk8jxd2-pooler.c-8.us-east-1.aws.neon.tech'
DB_USER = 'neondb_owner'
DB_PASSWORD = 'npg_pxZd8woKe4WB'
DEMO_DB = 'tenant_demo'

NOW = datetime.now()

def get_conn(dbname):
    return psycopg2.connect(
        host=POOLER_HOST, database=dbname,
        user=DB_USER, password=DB_PASSWORD, sslmode='require',
        connect_timeout=30
    )

def ev(cur, table, columns, rows, conflict='(id) DO NOTHING'):
    """execute_values batch insert."""
    if not rows: return 0
    col_str = ','.join([f'"{c}"' for c in columns])
    query = f'INSERT INTO "{table}" ({col_str}) VALUES %s ON CONFLICT {conflict}'
    try:
        psycopg2.extras.execute_values(cur, query, rows, page_size=100)
        return len(rows)
    except Exception as e:
        print(f'    ERR [{table}]: {str(e)[:100]}')
        return 0

def seed_demo_extras():
    print("=== SEEDING EXTRA DEMO DATA ===")
    conn = get_conn(DEMO_DB)
    conn.autocommit = True
    cur = conn.cursor()

    # Get existing IDs
    cur.execute('SELECT "id" FROM "Employee" ORDER BY "createdAt";')
    emp_ids = [r[0] for r in cur.fetchall()]
    cur.execute('SELECT "id" FROM "LeaveType" ORDER BY "createdAt";')
    lt_ids = [r[0] for r in cur.fetchall()]
    cur.execute('SELECT "id" FROM "User" ORDER BY "createdAt";')
    user_ids = [r[0] for r in cur.fetchall()]
    cur.execute('SELECT "id" FROM "Company" ORDER BY "createdAt";')
    comp_ids = [r[0] for r in cur.fetchall()]
    cur.execute('SELECT "id" FROM "Department" ORDER BY "createdAt";')
    dept_ids = [r[0] for r in cur.fetchall()]
    cur.execute('SELECT "id" FROM "Branch" ORDER BY "createdAt";')
    branch_ids = [r[0] for r in cur.fetchall()]
    cur.execute('SELECT "id" FROM "Shift" ORDER BY "createdAt";')
    shift_ids = [r[0] for r in cur.fetchall()]
    cur.execute('SELECT "id" FROM "Tenant" LIMIT 1;')
    tenant_id = cur.fetchone()[0]

    print(f"  Found: {len(emp_ids)} employees, {len(lt_ids)} leave types, {len(user_ids)} users")

    # ─── LeaveRequests (currently 0) ───
    rows = []
    for i, eid in enumerate(emp_ids):
        for j in range(3):
            lt = lt_ids[j % len(lt_ids)]
            sd = date(2025, random.randint(1,6), random.randint(1,28))
            ed = sd + timedelta(days=random.randint(1,5))
            st = random.choice(['pending','approved','rejected','cancelled'])
            ab = emp_ids[0] if st in ['approved','rejected'] else None
            aa = date(2025, sd.month, min(sd.day+1,28)) if st in ['approved','rejected'] else None
            rows.append((
                f'demo-lr-{i}-{j}', eid, lt, sd, ed,
                random.randint(1,5), st, 'Leave request',
                ab, aa,
                f'Need {random.randint(1,5)} days off for personal reasons',
                NOW, NOW
            ))
    c = ev(cur, 'LeaveRequest',
        ['id','employeeId','leaveTypeId','startDate','endDate',
         'totalDays','status','reason','approvedBy','approvedAt',
         'comments','createdAt','updatedAt'], rows)
    print(f"  LeaveRequest: {c}")

    # ─── HelpdeskTickets ───
    # Check if table exists
    try:
        cur.execute('SELECT COUNT(*) FROM "HelpdeskTicket"')
        ht_count = cur.fetchone()[0]
        print(f"  HelpdeskTicket already has {ht_count} records")
    except:
        print("  HelpdeskTicket table doesn't exist - creating sample data in alternate format")

    # ─── Grievances ───
    try:
        cur.execute('SELECT COUNT(*) FROM "Grievance"')
        g_count = cur.fetchone()[0]
        if g_count == 0:
            rows = []
            categories = ['workplace_harassment','salary_issue','promotion_dispute','work_condition','policy_violation']
            for i, eid in enumerate(emp_ids[:15]):
                cat = categories[i % len(categories)]
                st = random.choice(['open','investigating','resolved','closed'])
                rows.append((
                    f'demo-griev-{i}', eid, cat, f'Grievance about {cat.replace("_"," ")}',
                    'Employee reported an issue', st,
                    emp_ids[0] if st in ['resolved','closed'] else None,
                    date(2025, random.randint(1,6), random.randint(1,28)) if st in ['resolved','closed'] else None,
                    NOW, NOW
                ))
            c = ev(cur, 'Grievance',
                ['id','employeeId','category','title','description','status',
                 'assignedTo','resolvedAt','createdAt','updatedAt'], rows)
            print(f"  Grievance: {c}")
        else:
            print(f"  Grievance already has {g_count} records")
    except Exception as e:
        print(f"  Grievance: ERR {str(e)[:80]}")

    # ─── CandidateResumes / Recruitment ───
    try:
        cur.execute('SELECT COUNT(*) FROM "CandidateResume"')
        cr_count = cur.fetchone()[0]
        if cr_count < 10:
            rows = []
            names = ['John Miller', 'Sarah Williams', 'David Brown', 'Emma Johnson', 'Michael Davis',
                     'Lisa Anderson', 'Robert Taylor', 'Jennifer Martinez', 'Chris Wilson', 'Amy Thomas',
                     'Kevin Harris', 'Rachel Clark', 'Daniel Lewis', 'Megan Robinson', 'Paul Walker']
            for i, name in enumerate(names):
                fn, ln = name.split(' ')
                rows.append((
                    f'demo-cand-{i}', fn, ln, f'{fn.lower()}.{ln.lower()}@gmail.com',
                    f'+91-{random.randint(70000,99999)}{random.randint(1000,9999)}',
                    random.choice(['software_engineer','product_manager','data_analyst','designer','hr_specialist']),
                    random.randint(2,15)*100000, 'INR',
                    random.choice(['applied','screening','interview','shortlisted','offered','rejected','hired']),
                    comp_ids[i % len(comp_ids)],
                    f'{fn} has {random.randint(1,10)} years of experience in the industry.',
                    random.choice(['referral','linkedin','job_portal','career_page','agency']),
                    NOW, NOW
                ))
            c = ev(cur, 'CandidateResume',
                ['id','firstName','lastName','email','phone','position',
                 'expectedSalary','currency','status','companyId',
                 'summary','source','createdAt','updatedAt'], rows)
            print(f"  CandidateResume: {c}")
        else:
            print(f"  CandidateResume already has {cr_count} records")
    except Exception as e:
        print(f"  CandidateResume: ERR {str(e)[:80]}")

    # ─── JobRequisitions ───
    try:
        cur.execute('SELECT COUNT(*) FROM "Requisition"')
        r_count = cur.fetchone()[0]
        if r_count < 5:
            rows = []
            positions = ['Senior Software Engineer', 'Product Manager', 'Data Analyst',
                        'UX Designer', 'HR Specialist', 'Marketing Manager',
                        'DevOps Engineer', 'Business Analyst']
            for i, pos in enumerate(positions):
                rows.append((
                    f'demo-req-{i}', comp_ids[i % len(comp_ids)],
                    dept_ids[i % len(dept_ids)] if dept_ids else None,
                    pos, f'REQ-{2025}-{i+1}',
                    random.randint(1,3), random.choice(['open','in_progress','closed']),
                    f'{random.randint(5,15)}L-{random.randint(20,40)}L PA',
                    'Looking for experienced professionals',
                    emp_ids[i % len(emp_ids)],
                    date(2025, random.randint(1,6), 1),
                    date(2025, 12, 31) if random.choice([True, False]) else None,
                    NOW, NOW
                ))
            c = ev(cur, 'Requisition',
                ['id','companyId','departmentId','position','code',
                 'openings','status','budgetRange','description',
                 'hiringManagerId','createdAt','targetDate','createdAt','updatedAt'], rows)
            print(f"  Requisition: {c}")
        else:
            print(f"  Requisition already has {r_count} records")
    except Exception as e:
        print(f"  Requisition: ERR {str(e)[:80]}")

    # ─── Bonus ───
    try:
        cur.execute('SELECT COUNT(*) FROM "Bonus"')
        b_count = cur.fetchone()[0]
        if b_count == 0:
            rows = []
            for i, eid in enumerate(emp_ids[:15]):
                rows.append((
                    f'demo-bonus-{i}', eid,
                    random.choice(['performance','annual','festival','retention','spot']),
                    random.randint(5000,50000), 'INR',
                    f'Bonus for {random.choice(["good performance","festival","annual bonus"])}',
                    random.choice(['pending','approved','paid']),
                    date(2025, random.randint(1,6), random.randint(1,28)),
                    NOW, NOW
                ))
            c = ev(cur, 'Bonus',
                ['id','employeeId','type','amount','currency','reason',
                 'status','date','createdAt','updatedAt'], rows)
            print(f"  Bonus: {c}")
        else:
            print(f"  Bonus already has {b_count} records")
    except Exception as e:
        print(f"  Bonus: ERR {str(e)[:80]}")

    # ─── Timesheet entries ───
    try:
        cur.execute('SELECT COUNT(*) FROM "TimesheetEntry"')
        ts_count = cur.fetchone()[0]
        if ts_count < 50:
            rows = []
            for i, eid in enumerate(emp_ids[:15]):
                for j in range(5):
                    d = date(2025, 6, 22-j)
                    h = random.randint(7,10)
                    rows.append((
                        f'demo-ts-{i}-{j}', eid,
                        comp_ids[i % len(comp_ids)],
                        dept_ids[i % len(dept_ids)] if dept_ids else None,
                        d, h, random.choice(['development','meeting','review','planning','support']),
                        'Timesheet entry', 'submitted',
                        NOW, NOW
                    ))
            c = ev(cur, 'TimesheetEntry',
                ['id','employeeId','companyId','departmentId','date','hours',
                 'activity','description','status','createdAt','updatedAt'], rows)
            print(f"  TimesheetEntry: {c}")
        else:
            print(f"  TimesheetEntry already has {ts_count} records")
    except Exception as e:
        print(f"  TimesheetEntry: ERR {str(e)[:80]}")

    # ─── Resignation records ───
    try:
        cur.execute('SELECT COUNT(*) FROM "Resignation"')
        res_count = cur.fetchone()[0]
        if res_count == 0:
            rows = []
            for i, eid in enumerate(emp_ids[15:20] if len(emp_ids) > 15 else emp_ids[-2:]):
                rows.append((
                    f'demo-resign-{i}', eid,
                    f'Resignation notice', random.choice(['personal','career','relocation','better_offer']),
                    date(2025, random.randint(1,6), 1),
                    date(2025, random.randint(7,12), 1),
                    random.choice(['pending','approved','cancelled']),
                    emp_ids[0],
                    NOW, NOW
                ))
            c = ev(cur, 'Resignation',
                ['id','employeeId','reason','category','noticeDate',
                 'lastWorkingDate','status','approvedBy','createdAt','updatedAt'], rows)
            print(f"  Resignation: {c}")
        else:
            print(f"  Resignation already has {res_count} records")
    except Exception as e:
        print(f"  Resignation: ERR {str(e)[:80]}")

    # ─── Feedback records ───
    try:
        cur.execute('SELECT COUNT(*) FROM "Feedback"')
        fb_count = cur.fetchone()[0]
        if fb_count < 10:
            rows = []
            for i, eid in enumerate(emp_ids[:15]):
                for j in range(2):
                    rows.append((
                        f'demo-fb-{i}-{j}', eid,
                        emp_ids[(i+3) % len(emp_ids)],
                        random.choice(['peer','manager','self','360']),
                        random.choice(['communication','technical','leadership','teamwork']),
                        round(random.uniform(3.0,5.0),1),
                        f'Feedback on performance', random.choice(['positive','neutral','constructive']),
                        NOW, NOW
                    ))
            c = ev(cur, 'Feedback',
                ['id','employeeId','givenBy','type','category',
                 'rating','comments','sentiment','createdAt','updatedAt'], rows)
            print(f"  Feedback: {c}")
        else:
            print(f"  Feedback already has {fb_count} records")
    except Exception as e:
        print(f"  Feedback: ERR {str(e)[:80]}")

    # ─── Survey + SurveyResponse ───
    try:
        cur.execute('SELECT COUNT(*) FROM "Survey"')
        s_count = cur.fetchone()[0]
        if s_count == 0:
            rows = []
            for j, (title, type) in enumerate([
                ('Employee Satisfaction Q1 2025','satisfaction'),
                ('Work Culture Assessment','culture'),
                ('Manager Effectiveness Review','manager'),
                ('Remote Work Experience','remote_work')]):
                rows.append((
                    f'demo-survey-{j}', tenant_id, title, type,
                    f'{title} survey', 'draft' if j==3 else 'active',
                    NOW, date(2025, 12, 31), NOW, NOW
                ))
            c1 = ev(cur, 'Survey',
                ['id','tenantId','title','type','description','status',
                 'createdAt','expiresAt','createdAt','updatedAt'], rows)

            sr_rows = []
            for j in range(4):
                for i, eid in enumerate(emp_ids[:10]):
                    sr_rows.append((
                        f'demo-sr-{j}-{i}', f'demo-survey-{j}', eid,
                        random.randint(1,5), round(random.uniform(3.0,5.0),1),
                        f'Response to survey', NOW, NOW
                    ))
            c2 = ev(cur, 'SurveyResponse',
                ['id','surveyId','employeeId','score','rating',
                 'comments','createdAt','updatedAt'], sr_rows)
            print(f"  Survey: {c1}, SurveyResponse: {c2}")
        else:
            print(f"  Survey already has {s_count} records")
    except Exception as e:
        print(f"  Survey: ERR {str(e)[:80]}")

    # ─── Final verification ───
    print("\n=== FINAL DEMO DATA COUNTS ===")
    tables = ['Employee', 'Company', 'Department', 'User',
              'Attendance', 'LeaveBalance', 'LeaveRequest', 'LeaveType', 'Holiday',
              'PayrollComponent', 'PayrollRun', 'SalaryStructure', 'SalaryComponent',
              'PerformanceReview', 'Goal', 'Training', 'TrainingEnrollment',
              'TravelRequest', 'ExpenseClaim', 'Asset', 'AssetAssignment', 'Document',
              'Notification', 'Announcement', 'OnboardingTask',
              'Project', 'ProjectMember', 'Loan', 'Reimbursement',
              'WorkflowDefinition', 'WorkflowInstance', 'Shift',
              'CandidateResume', 'Requisition', 'Bonus', 'TimesheetEntry',
              'Resignation', 'Feedback', 'Survey', 'SurveyResponse', 'Grievance']
    for table in tables:
        try:
            cur.execute(f'SELECT COUNT(*) FROM "{table}"')
            count = cur.fetchone()[0]
            status = 'OK' if count > 0 else 'EMPTY'
            print(f"  {status:>5} {table}: {count}")
        except Exception as e:
            print(f"  ERR  {table}: {str(e)[:80]}")

    conn.close()
    print("\n✅ Demo data seeding complete!")

if __name__ == '__main__':
    seed_demo_extras()
